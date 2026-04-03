import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './users.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { email: email.toLowerCase() } });
  }

  async findById(id: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { id } });
  }

  async create(email: string, password: string, firstName?: string, lastName?: string): Promise<User> {
    const existing = await this.findByEmail(email);
    if (existing) {
      throw new ConflictException('User with this email already exists');
    }
    const rounds = parseInt(process.env.BCRYPT_ROUNDS ?? '10', 10);
    const passwordHash = await bcrypt.hash(password, rounds);
    const user = this.usersRepo.create({
      email: email.toLowerCase(),
      passwordHash,
      firstName: firstName ?? null,
      lastName: lastName ?? null,
    });
    return this.usersRepo.save(user);
  }

  async validatePassword(user: User, password: string): Promise<boolean> {
    return bcrypt.compare(password, user.passwordHash);
  }

  async setRefreshToken(userId: string, refreshToken: string | null): Promise<void> {
    const rounds = parseInt(process.env.BCRYPT_ROUNDS ?? '10', 10);
    const hash = refreshToken ? await bcrypt.hash(refreshToken, rounds) : null;
    await this.usersRepo.update(userId, {
      refreshTokenHash: hash,
      lastLoginAt: refreshToken ? new Date() : undefined,
    });
  }

  async validateRefreshToken(userId: string, refreshToken: string): Promise<boolean> {
    const user = await this.findById(userId);
    if (!user || !user.refreshTokenHash) return false;
    return bcrypt.compare(refreshToken, user.refreshTokenHash);
  }

  async updateLastLogin(userId: string): Promise<void> {
    await this.usersRepo.update(userId, { lastLoginAt: new Date() });
  }

  async setTwoFactorSecret(userId: string, secret: string): Promise<void> {
    await this.usersRepo.update(userId, { twoFactorSecret: secret });
  }

  async enableTwoFactor(userId: string): Promise<void> {
    await this.usersRepo.update(userId, { twoFactorEnabled: true });
  }

  async disableTwoFactor(userId: string): Promise<void> {
    await this.usersRepo.update(userId, {
      twoFactorEnabled: false,
      twoFactorSecret: null,
      backupCodes: null,
    });
  }

  async setBackupCodes(userId: string, hashedCodes: string[]): Promise<void> {
    await this.usersRepo.update(userId, { backupCodes: hashedCodes });
  }

  async setTwoFactorRequired(userId: string, required: boolean): Promise<void> {
    await this.usersRepo.update(userId, { twoFactorRequired: required });
  }
}
