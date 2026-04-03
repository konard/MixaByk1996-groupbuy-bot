import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { UsersService } from '../users/users.service';
import { RedisService } from '../redis/redis.service';
import { User } from '../users/users.entity';

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
    return this.generateTokens(user);
  }

  async login(email: string, password: string): Promise<TokenPair> {
    const user = await this.usersService.findByEmail(email);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    if (!user.isActive) throw new UnauthorizedException('Account is disabled');

    const valid = await this.usersService.validatePassword(user, password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    return this.generateTokens(user);
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
