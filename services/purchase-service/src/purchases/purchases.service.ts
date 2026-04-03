import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Purchase, PurchaseStatus } from './purchases.entity';
import { KafkaProducer } from '../kafka/kafka.producer';

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
}

@Injectable()
export class PurchasesService {
  constructor(
    @InjectRepository(Purchase)
    private readonly purchaseRepo: Repository<Purchase>,
    private readonly kafkaProducer: KafkaProducer,
  ) {}

  async create(dto: CreatePurchaseDto): Promise<Purchase> {
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
      status: PurchaseStatus.DRAFT,
    });
    const saved = await this.purchaseRepo.save(purchase);

    await this.kafkaProducer.send('purchase.created', {
      purchaseId: saved.id,
      organizerId: saved.organizerId,
      title: saved.title,
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
    Object.assign(purchase, updates);
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

    return saved;
  }
}
