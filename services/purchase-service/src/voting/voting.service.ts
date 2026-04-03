import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { VotingSession, VotingStatus, Candidate, Vote } from './voting.entity';
import { Purchase, PurchaseStatus } from '../purchases/purchases.entity';
import { KafkaProducer } from '../kafka/kafka.producer';

export interface CreateVotingSessionDto {
  purchaseId: string;
  closesAt: Date;
  allowAddCandidates?: boolean;
  allowChangeVote?: boolean;
  minVotesToClose?: number;
}

export interface AddCandidateDto {
  supplierName: string;
  description?: string;
  pricePerUnit?: number;
  unit?: string;
  supplierUrl?: string;
  metadata?: Record<string, any>;
}

export interface CastVoteDto {
  candidateId: string;
  comment?: string;
}

@Injectable()
export class VotingService {
  private readonly logger = new Logger(VotingService.name);

  constructor(
    @InjectRepository(VotingSession)
    private readonly sessionRepo: Repository<VotingSession>,
    @InjectRepository(Candidate)
    private readonly candidateRepo: Repository<Candidate>,
    @InjectRepository(Vote)
    private readonly voteRepo: Repository<Vote>,
    @InjectRepository(Purchase)
    private readonly purchaseRepo: Repository<Purchase>,
    private readonly dataSource: DataSource,
    private readonly kafkaProducer: KafkaProducer,
  ) {}

  // ─── Create Voting Session ─────────────────────────────────────────────────

  async createSession(dto: CreateVotingSessionDto): Promise<VotingSession> {
    const purchase = await this.purchaseRepo.findOne({
      where: { id: dto.purchaseId },
    });
    if (!purchase) throw new NotFoundException('Purchase not found');
    if (purchase.status !== PurchaseStatus.DRAFT) {
      throw new BadRequestException('Voting can only be started for draft purchases');
    }

    if (dto.closesAt <= new Date()) {
      throw new BadRequestException('closesAt must be in the future');
    }

    return this.dataSource.transaction(async (manager) => {
      const session = manager.create(VotingSession, {
        purchaseId: dto.purchaseId,
        closesAt: dto.closesAt,
        allowAddCandidates: dto.allowAddCandidates ?? true,
        allowChangeVote: dto.allowChangeVote ?? true,
        minVotesToClose: dto.minVotesToClose ?? 1,
        status: VotingStatus.OPEN,
      });
      const saved = await manager.save(VotingSession, session);

      await manager.update(Purchase, dto.purchaseId, {
        status: PurchaseStatus.VOTING,
      });

      await this.kafkaProducer.send('purchase.voting.started', {
        purchaseId: dto.purchaseId,
        sessionId: saved.id,
        closesAt: dto.closesAt,
      });

      return saved;
    });
  }

  // ─── Add Candidate ─────────────────────────────────────────────────────────

  async addCandidate(
    sessionId: string,
    userId: string,
    dto: AddCandidateDto,
  ): Promise<Candidate> {
    const session = await this.getOpenSession(sessionId);

    if (!session.allowAddCandidates) {
      throw new ForbiddenException('Adding candidates is not allowed in this session');
    }

    const candidate = this.candidateRepo.create({
      votingSessionId: sessionId,
      supplierName: dto.supplierName,
      description: dto.description ?? null,
      pricePerUnit: dto.pricePerUnit ?? null,
      unit: dto.unit ?? null,
      supplierUrl: dto.supplierUrl ?? null,
      proposedBy: userId,
      metadata: dto.metadata ?? {},
    });
    const saved = await this.candidateRepo.save(candidate);

    await this.kafkaProducer.send('purchase.candidate.added', {
      sessionId,
      candidateId: saved.id,
      proposedBy: userId,
      supplierName: dto.supplierName,
    });

    return saved;
  }

  // ─── Cast / Change Vote ────────────────────────────────────────────────────

  async castVote(
    sessionId: string,
    userId: string,
    dto: CastVoteDto,
  ): Promise<Vote> {
    const session = await this.getOpenSession(sessionId);

    // Verify candidate belongs to this session
    const candidate = await this.candidateRepo.findOne({
      where: { id: dto.candidateId, votingSessionId: sessionId },
    });
    if (!candidate) throw new NotFoundException('Candidate not found in this session');

    return this.dataSource.transaction(async (manager) => {
      const existing = await manager.findOne(Vote, {
        where: { votingSessionId: sessionId, userId },
      });

      if (existing) {
        if (!session.allowChangeVote) {
          throw new ForbiddenException('Changing vote is not allowed in this session');
        }
        if (existing.candidateId === dto.candidateId) {
          throw new BadRequestException('Already voted for this candidate');
        }
        // Change vote
        const oldCandidateId = existing.candidateId;
        existing.candidateId = dto.candidateId;
        existing.comment = dto.comment ?? existing.comment;
        existing.changedCount += 1;
        const updated = await manager.save(Vote, existing);

        await this.kafkaProducer.send('purchase.vote.changed', {
          sessionId,
          userId,
          oldCandidateId,
          newCandidateId: dto.candidateId,
        });

        return updated;
      }

      // New vote
      const vote = manager.create(Vote, {
        votingSessionId: sessionId,
        candidateId: dto.candidateId,
        userId,
        comment: dto.comment ?? null,
        changedCount: 0,
      });
      const saved = await manager.save(Vote, vote);

      await this.kafkaProducer.send('purchase.vote.cast', {
        sessionId,
        userId,
        candidateId: dto.candidateId,
      });

      return saved;
    });
  }

  // ─── Get Session Results ───────────────────────────────────────────────────

  async getSessionResults(sessionId: string): Promise<{
    session: VotingSession;
    tally: Array<{ candidate: Candidate; voteCount: number }>;
    winner: Candidate | null;
  }> {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId },
      relations: ['candidates', 'votes'],
    });
    if (!session) throw new NotFoundException('Voting session not found');

    const countMap = new Map<string, number>();
    for (const vote of session.votes) {
      countMap.set(vote.candidateId, (countMap.get(vote.candidateId) ?? 0) + 1);
    }

    const tally = session.candidates.map((c) => ({
      candidate: c,
      voteCount: countMap.get(c.id) ?? 0,
    }));
    tally.sort((a, b) => b.voteCount - a.voteCount);

    const winner =
      session.status === VotingStatus.CLOSED && session.winnerCandidateId
        ? session.candidates.find((c) => c.id === session.winnerCandidateId) ?? null
        : null;

    return { session, tally, winner };
  }

  // ─── Manual Close ──────────────────────────────────────────────────────────

  async closeSession(sessionId: string, requesterId: string): Promise<VotingSession> {
    const session = await this.getOpenSession(sessionId);
    const purchase = await this.purchaseRepo.findOne({ where: { id: session.purchaseId } });
    if (!purchase) throw new NotFoundException('Purchase not found');

    // Only organizer can close manually
    if (purchase.organizerId !== requesterId) {
      throw new ForbiddenException('Only the organizer can close voting');
    }
    return this.doCloseSession(session);
  }

  // ─── Scheduler: Auto-close expired sessions ────────────────────────────────

  @Cron(CronExpression.EVERY_5_MINUTES)
  async autoCloseExpiredSessions(): Promise<void> {
    const expired = await this.sessionRepo.find({
      where: { status: VotingStatus.OPEN },
      relations: ['votes', 'candidates'],
    });

    const now = new Date();
    for (const session of expired) {
      if (session.closesAt <= now) {
        try {
          await this.doCloseSession(session);
          this.logger.log(`Auto-closed voting session ${session.id}`);
        } catch (err) {
          this.logger.error(`Failed to auto-close session ${session.id}: ${err}`);
        }
      }
    }
  }

  // ─── Internal: Close Session ───────────────────────────────────────────────

  private async doCloseSession(session: VotingSession): Promise<VotingSession> {
    return this.dataSource.transaction(async (manager) => {
      // Find winner by vote count
      const votes = await manager.find(Vote, { where: { votingSessionId: session.id } });
      const countMap = new Map<string, number>();
      for (const v of votes) {
        countMap.set(v.candidateId, (countMap.get(v.candidateId) ?? 0) + 1);
      }

      let winnerId: string | null = null;
      let maxVotes = 0;
      for (const [candidateId, count] of countMap.entries()) {
        if (count > maxVotes) {
          maxVotes = count;
          winnerId = candidateId;
        }
      }

      session.status = VotingStatus.CLOSED;
      session.winnerCandidateId = winnerId;
      const saved = await manager.save(VotingSession, session);

      // Update purchase status
      await manager.update(Purchase, session.purchaseId, {
        status: winnerId ? PurchaseStatus.APPROVED : PurchaseStatus.CANCELLED,
        closedAt: new Date(),
      });

      await this.kafkaProducer.send('purchase.voting.closed', {
        sessionId: session.id,
        purchaseId: session.purchaseId,
        winnerId,
        totalVotes: votes.length,
      });

      return saved;
    });
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private async getOpenSession(sessionId: string): Promise<VotingSession> {
    const session = await this.sessionRepo.findOne({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Voting session not found');
    if (session.status !== VotingStatus.OPEN) {
      throw new BadRequestException('Voting session is not open');
    }
    if (session.closesAt <= new Date()) {
      throw new BadRequestException('Voting session has expired');
    }
    return session;
  }
}
