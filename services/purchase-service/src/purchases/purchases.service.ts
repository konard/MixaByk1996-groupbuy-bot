import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Purchase, PurchaseStatus } from './purchases.entity';
import { KafkaProducer } from '../kafka/kafka.producer';

const MAX_ACTIVE_PURCHASES = 50;
const WARN_ACTIVE_PURCHASES = 40;

export interface CreatePurchaseDto {
  title: string;
  description?: string;
  organizerId: string;
  minParticipants?: number;
  maxParticipants?: number;
  targetAmount?: number;
  currency?: string;
  category?: string;
  deadlineAt?: Date;
  commissionPercent?: number;
  escrowThreshold?: number;
}

@Injectable()
export class PurchasesService {
  private readonly logger = new Logger(PurchasesService.name);

  constructor(
    @InjectRepository(Purchase)
    private readonly purchaseRepo: Repository<Purchase>,
    private readonly kafkaProducer: KafkaProducer,
  ) {}

  private validateCommission(commissionPercent: number): void {
    if (commissionPercent < 0 || commissionPercent > 10) {
      throw new BadRequestException('Commission percent must be between 0 and 10');
    }
    // Step of 0.5: multiply by 2 and check it's an integer
    if ((commissionPercent * 2) % 1 !== 0) {
      throw new BadRequestException('Commission percent must be in steps of 0.5');
    }
  }

  private computeEscrowRequired(targetAmount: number | null, escrowThreshold: number): boolean {
    if (targetAmount == null) return false;
    return targetAmount > escrowThreshold;
  }

  private async checkOrganizerQuota(organizerId: string): Promise<void> {
    const activeStatuses = [
      PurchaseStatus.DRAFT,
      PurchaseStatus.VOTING,
      PurchaseStatus.APPROVED,
      PurchaseStatus.PAYMENT_PENDING,
    ];
    const activeCount = await this.purchaseRepo
      .createQueryBuilder('p')
      .where('p.organizer_id = :organizerId', { organizerId })
      .andWhere('p.status IN (:...statuses)', { statuses: activeStatuses })
      .getCount();

    if (activeCount >= MAX_ACTIVE_PURCHASES) {
      throw new BadRequestException(
        `Organizer has reached the maximum of ${MAX_ACTIVE_PURCHASES} active purchases`,
      );
    }
    if (activeCount >= WARN_ACTIVE_PURCHASES) {
      this.logger.warn(
        `Organizer ${organizerId} has ${activeCount} active purchases (limit: ${MAX_ACTIVE_PURCHASES})`,
      );
    }
  }

  async create(dto: CreatePurchaseDto): Promise<Purchase> {
    const commissionPercent = dto.commissionPercent ?? 0;
    this.validateCommission(commissionPercent);

    await this.checkOrganizerQuota(dto.organizerId);

    const escrowThreshold = dto.escrowThreshold ?? 1000000;
    const escrowRequired = this.computeEscrowRequired(dto.targetAmount ?? null, escrowThreshold);

    const purchase = this.purchaseRepo.create({
      title: dto.title,
      description: dto.description ?? null,
      organizerId: dto.organizerId,
      minParticipants: dto.minParticipants ?? 2,
      maxParticipants: dto.maxParticipants ?? null,
      targetAmount: dto.targetAmount ?? null,
      currency: dto.currency ?? 'RUB',
      category: dto.category ?? null,
      deadlineAt: dto.deadlineAt ?? null,
      commissionPercent,
      escrowRequired,
      escrowThreshold,
      status: PurchaseStatus.DRAFT,
    });
    const saved = await this.purchaseRepo.save(purchase);

    await this.kafkaProducer.send('purchase.created', {
      purchaseId: saved.id,
      organizerId: saved.organizerId,
      title: saved.title,
      commissionPercent: saved.commissionPercent,
      escrowRequired: saved.escrowRequired,
    });

    return saved;
  }

  async findAll(page = 1, limit = 20): Promise<{ data: Purchase[]; total: number }> {
    const [data, total] = await this.purchaseRepo.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total };
  }

  async findById(id: string): Promise<Purchase> {
    const purchase = await this.purchaseRepo.findOne({
      where: { id },
      relations: ['votingSession'],
    });
    if (!purchase) throw new NotFoundException('Purchase not found');
    return purchase;
  }

  async update(
    id: string,
    requesterId: string,
    updates: Partial<CreatePurchaseDto>,
  ): Promise<Purchase> {
    const purchase = await this.findById(id);
    if (purchase.organizerId !== requesterId) {
      throw new ForbiddenException('Only the organizer can update this purchase');
    }
    if (purchase.status !== PurchaseStatus.DRAFT) {
      throw new BadRequestException('Can only update draft purchases');
    }

    if (updates.commissionPercent != null) {
      this.validateCommission(updates.commissionPercent);
    }

    Object.assign(purchase, updates);

    // Recompute escrow if targetAmount or escrowThreshold changed
    const escrowThreshold = purchase.escrowThreshold;
    purchase.escrowRequired = this.computeEscrowRequired(purchase.targetAmount, escrowThreshold);

    return this.purchaseRepo.save(purchase);
  }

  async cancel(id: string, requesterId: string): Promise<Purchase> {
    const purchase = await this.findById(id);
    if (purchase.organizerId !== requesterId) {
      throw new ForbiddenException('Only the organizer can cancel this purchase');
    }
    if ([PurchaseStatus.COMPLETED, PurchaseStatus.CANCELLED].includes(purchase.status)) {
      throw new BadRequestException('Purchase is already completed or cancelled');
    }
    purchase.status = PurchaseStatus.CANCELLED;
    purchase.closedAt = new Date();
    const saved = await this.purchaseRepo.save(purchase);

    await this.kafkaProducer.send('purchase.cancelled', {
      purchaseId: id,
      organizerId: requesterId,
    });

    // Emit commission calculated event when purchase stops
    if (saved.commissionPercent > 0 && saved.targetAmount != null) {
      const commissionAmount = (saved.targetAmount * saved.commissionPercent) / 100;
      await this.kafkaProducer.send('purchase.commission.calculated', {
        purchaseId: saved.id,
        organizerId: saved.organizerId,
        targetAmount: saved.targetAmount,
        commissionPercent: saved.commissionPercent,
        commissionAmount,
        currency: saved.currency,
      });
    }

    return saved;
  }

  async emitCommissionOnComplete(purchaseId: string): Promise<void> {
    const purchase = await this.findById(purchaseId);
    if (purchase.commissionPercent > 0 && purchase.targetAmount != null) {
      const commissionAmount = (purchase.targetAmount * purchase.commissionPercent) / 100;
      await this.kafkaProducer.send('purchase.commission.calculated', {
        purchaseId: purchase.id,
        organizerId: purchase.organizerId,
        targetAmount: purchase.targetAmount,
        commissionPercent: purchase.commissionPercent,
        commissionAmount,
        currency: purchase.currency,
      });
    }
  }
}
