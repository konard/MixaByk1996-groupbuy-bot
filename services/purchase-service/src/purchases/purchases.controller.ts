import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsDateString,
  MinLength,
  Min,
} from 'class-validator';
import { PurchasesService } from './purchases.service';

class CreatePurchaseDto {
  @IsString()
  @MinLength(3)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(2)
  minParticipants?: number;

  @IsOptional()
  @IsNumber()
  maxParticipants?: number;

  @IsOptional()
  @IsNumber()
  targetAmount?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsDateString()
  deadlineAt?: string;
}

function getUserId(headers: Record<string, string>): string {
  const userId = headers['x-user-id'];
  if (!userId) throw new Error('x-user-id header required');
  return userId;
}

@Controller('purchases')
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  @Get('health')
  health() {
    return { status: 'ok', service: 'purchase-service' };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreatePurchaseDto,
    @Headers() headers: Record<string, string>,
  ) {
    const organizerId = getUserId(headers);
    const purchase = await this.purchasesService.create({
      ...dto,
      organizerId,
      deadlineAt: dto.deadlineAt ? new Date(dto.deadlineAt) : undefined,
    });
    return { success: true, data: purchase };
  }

  @Get()
  async findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    const result = await this.purchasesService.findAll(page, Math.min(limit, 100));
    return { success: true, ...result };
  }

  @Get(':id')
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    const purchase = await this.purchasesService.findById(id);
    return { success: true, data: purchase };
  }

  @Put(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Partial<CreatePurchaseDto>,
    @Headers() headers: Record<string, string>,
  ) {
    const requesterId = getUserId(headers);
    const purchase = await this.purchasesService.update(id, requesterId, dto);
    return { success: true, data: purchase };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers() headers: Record<string, string>,
  ) {
    const requesterId = getUserId(headers);
    const purchase = await this.purchasesService.cancel(id, requesterId);
    return { success: true, data: purchase };
  }
}
