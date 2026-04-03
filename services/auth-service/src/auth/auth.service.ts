import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { authenticator } from 'otplib';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { UsersService } from '../users/users.service';
import { RedisService } from '../redis/redis.service';
import { User, UserRole } from '../users/users.entity';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  jti: string;
}

export interface TwoFactorSetupResult {
  otpauthUri: string;
  backupCodes: string[];
}

export interface LoginResult {
  requires2FA: boolean;
  tempToken?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
}

const ROLES_REQUIRING_2FA: string[] = [UserRole.ORGANIZER, UserRole.SUPPLIER];
const BACKUP_CODE_COUNT = 10;
const TEMP_TOKEN_TTL_SECONDS = 300; // 5 minutes

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {}

  async register(
    email: string,
    password: string,
    firstName?: string,
    lastName?: string,
  ): Promise<TokenPair> {
    if (!email || !password || password.length < 8) {
      throw new BadRequestException('Email and password (min 8 chars) are required');
    }
    const user = await this.usersService.create(email, password, firstName, lastName);

    // Mark 2FA as required for organizer/supplier roles
    if (ROLES_REQUIRING_2FA.includes(user.role)) {
      await this.usersService.setTwoFactorRequired(user.id, true);
    }

    return this.generateTokens(user);
  }

  async login(email: string, password: string): Promise<LoginResult> {
    const user = await this.usersService.findByEmail(email);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    if (!user.isActive) throw new UnauthorizedException('Account is disabled');

    const valid = await this.usersService.validatePassword(user, password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    // If 2FA is enabled, return a temporary token instead of full JWT
    if (user.twoFactorEnabled) {
      const tempToken = uuidv4();
      await this.redisService.set(
        `2fa:temp:${tempToken}`,
        user.id,
        TEMP_TOKEN_TTL_SECONDS,
      );
      return { requires2FA: true, tempToken };
    }

    // If 2FA is required but not yet set up, still allow login but flag it
    if (user.twoFactorRequired && !user.twoFactorEnabled) {
      const tokens = await this.generateTokens(user);
      return { requires2FA: false, ...tokens };
    }

    const tokens = await this.generateTokens(user);
    return { requires2FA: false, ...tokens };
  }

  async loginWith2FA(tempToken: string, code: string): Promise<TokenPair> {
    const userId = await this.redisService.get(`2fa:temp:${tempToken}`);
    if (!userId) {
      throw new UnauthorizedException('Invalid or expired 2FA session');
    }

    const user = await this.usersService.findById(userId);
    if (!user) throw new UnauthorizedException('User not found');

    const isValid = await this.validate2FACode(user, code);
    if (!isValid) {
      throw new UnauthorizedException('Invalid 2FA code');
    }

    // Consume the temp token
    await this.redisService.del(`2fa:temp:${tempToken}`);

    return this.generateTokens(user);
  }

  async enable2FA(userId: string): Promise<TwoFactorSetupResult> {
    const user = await this.usersService.findById(userId);
    if (!user) throw new UnauthorizedException('User not found');

    if (user.twoFactorEnabled) {
      throw new BadRequestException('Two-factor authentication is already enabled');
    }

    const secret = authenticator.generateSecret();
    await this.usersService.setTwoFactorSecret(userId, secret);

    const appName = this.configService.get<string>('APP_NAME', 'AuthService');
    const otpauthUri = authenticator.keyuri(user.email, appName, secret);

    const { plainCodes, hashedCodes } = await this.generateBackupCodes();
    await this.usersService.setBackupCodes(userId, hashedCodes);

    return { otpauthUri, backupCodes: plainCodes };
  }

  async verify2FA(userId: string, code: string): Promise<boolean> {
    const user = await this.usersService.findById(userId);
    if (!user) throw new UnauthorizedException('User not found');

    if (!user.twoFactorSecret) {
      throw new BadRequestException('Two-factor authentication has not been initialized. Call enable2FA first.');
    }

    if (user.twoFactorEnabled) {
      throw new BadRequestException('Two-factor authentication is already verified and enabled');
    }

    const isValid = authenticator.verify({ token: code, secret: user.twoFactorSecret });
    if (!isValid) {
      throw new BadRequestException('Invalid verification code');
    }

    await this.usersService.enableTwoFactor(userId);
    return true;
  }

  async disable2FA(userId: string, code: string): Promise<void> {
    const user = await this.usersService.findById(userId);
    if (!user) throw new UnauthorizedException('User not found');

    if (!user.twoFactorEnabled) {
      throw new BadRequestException('Two-factor authentication is not enabled');
    }

    // Organizer/supplier roles cannot disable 2FA
    if (ROLES_REQUIRING_2FA.includes(user.role)) {
      throw new ForbiddenException('Two-factor authentication is mandatory for your role and cannot be disabled');
    }

    const isValid = await this.validate2FACode(user, code);
    if (!isValid) {
      throw new UnauthorizedException('Invalid 2FA code');
    }

    await this.usersService.disableTwoFactor(userId);
  }

  async regenerateBackupCodes(userId: string, code: string): Promise<string[]> {
    const user = await this.usersService.findById(userId);
    if (!user) throw new UnauthorizedException('User not found');

    if (!user.twoFactorEnabled) {
      throw new BadRequestException('Two-factor authentication is not enabled');
    }

    const isValid = await this.validate2FACode(user, code);
    if (!isValid) {
      throw new UnauthorizedException('Invalid 2FA code');
    }

    const { plainCodes, hashedCodes } = await this.generateBackupCodes();
    await this.usersService.setBackupCodes(userId, hashedCodes);

    return plainCodes;
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user) throw new UnauthorizedException('User not found');

    const valid = await this.usersService.validateRefreshToken(user.id, refreshToken);
    if (!valid) throw new UnauthorizedException('Refresh token mismatch');

    // Rotate: invalidate old, issue new
    await this.usersService.setRefreshToken(user.id, null);
    return this.generateTokens(user);
  }

  async logout(accessToken: string, userId: string): Promise<void> {
    // Blacklist the access token until it expires
    const jwtExpiresIn = this.configService.get<string>('JWT_EXPIRES_IN', '15m');
    const ttl = this.parseDurationSeconds(jwtExpiresIn);
    await this.redisService.set(`jwt:blacklist:${accessToken}`, '1', ttl);
    // Clear refresh token in DB
    await this.usersService.setRefreshToken(userId, null);
  }

  async validateToken(token: string): Promise<JwtPayload> {
    try {
      const payload = this.jwtService.verify<JwtPayload>(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });
      const blacklisted = await this.redisService.get(`jwt:blacklist:${token}`);
      if (blacklisted) throw new UnauthorizedException('Token revoked');
      return payload;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }

  // --- Private helpers ---

  private async validate2FACode(user: User, code: string): Promise<boolean> {
    if (!user.twoFactorSecret) return false;

    // Try TOTP first
    const totpValid = authenticator.verify({ token: code, secret: user.twoFactorSecret });
    if (totpValid) return true;

    // Try backup codes
    if (user.backupCodes && user.backupCodes.length > 0) {
      for (let i = 0; i < user.backupCodes.length; i++) {
        const match = await bcrypt.compare(code, user.backupCodes[i]);
        if (match) {
          // Remove the used backup code
          const updatedCodes = [...user.backupCodes];
          updatedCodes.splice(i, 1);
          await this.usersService.setBackupCodes(user.id, updatedCodes);
          return true;
        }
      }
    }

    return false;
  }

  private async generateBackupCodes(): Promise<{ plainCodes: string[]; hashedCodes: string[] }> {
    const plainCodes: string[] = [];
    const hashedCodes: string[] = [];
    const rounds = parseInt(process.env.BCRYPT_ROUNDS ?? '10', 10);

    for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
      const code = crypto.randomBytes(4).toString('hex'); // 8-char hex code
      plainCodes.push(code);
      hashedCodes.push(await bcrypt.hash(code, rounds));
    }

    return { plainCodes, hashedCodes };
  }

  private async generateTokens(user: User): Promise<TokenPair> {
    const jti = uuidv4();
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      jti,
    };

    const accessToken = this.jwtService.sign(payload);

    const refreshExpiresIn = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d');
    const refreshToken = this.jwtService.sign(
      { ...payload, jti: uuidv4() },
      {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: refreshExpiresIn,
      },
    );

    await this.usersService.setRefreshToken(user.id, refreshToken);

    const expiresInSec = this.parseDurationSeconds(
      this.configService.get<string>('JWT_EXPIRES_IN', '15m'),
    );

    return { accessToken, refreshToken, expiresIn: expiresInSec };
  }

  private parseDurationSeconds(duration: string): number {
    const match = duration.match(/^(\d+)([smhd])$/);
    if (!match) return 900;
    const value = parseInt(match[1], 10);
    const unit = match[2];
    const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
    return value * (multipliers[unit] ?? 1);
  }
}
