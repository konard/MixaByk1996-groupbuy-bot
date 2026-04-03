import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Headers,
  UnauthorizedException,
  Get,
  Req,
} from '@nestjs/common';
import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';
import { AuthService } from './auth.service';

class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;
}

class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}

class RefreshDto {
  @IsString()
  refreshToken: string;
}

class TwoFactorVerifyDto {
  @IsString()
  code: string;
}

class TwoFactorLoginDto {
  @IsString()
  tempToken: string;

  @IsString()
  code: string;
}

class TwoFactorDisableDto {
  @IsString()
  code: string;
}

class TwoFactorBackupCodesDto {
  @IsString()
  code: string;
}

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto) {
    const tokens = await this.authService.register(
      dto.email,
      dto.password,
      dto.firstName,
      dto.lastName,
    );
    return { success: true, data: tokens };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    const result = await this.authService.login(dto.email, dto.password);
    return { success: true, data: result };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshDto) {
    const tokens = await this.authService.refresh(dto.refreshToken);
    return { success: true, data: tokens };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Headers('authorization') authHeader: string, @Req() req: any) {
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('No token provided');
    }
    const token = authHeader.slice(7);
    // Validate to get userId
    const payload = await this.authService.validateToken(token);
    await this.authService.logout(token, payload.sub);
    return { success: true, message: 'Logged out successfully' };
  }

  @Get('validate')
  @HttpCode(HttpStatus.OK)
  async validate(@Headers('authorization') authHeader: string) {
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('No token provided');
    }
    const token = authHeader.slice(7);
    const payload = await this.authService.validateToken(token);
    return { success: true, data: payload };
  }

  @Get('health')
  health() {
    return { status: 'ok', service: 'auth-service' };
  }

  // --- Two-Factor Authentication Endpoints ---

  @Post('2fa/enable')
  @HttpCode(HttpStatus.OK)
  async enable2FA(@Headers('authorization') authHeader: string) {
    const payload = await this.extractAndValidateToken(authHeader);
    const result = await this.authService.enable2FA(payload.sub);
    return { success: true, data: result };
  }

  @Post('2fa/verify')
  @HttpCode(HttpStatus.OK)
  async verify2FA(
    @Headers('authorization') authHeader: string,
    @Body() dto: TwoFactorVerifyDto,
  ) {
    const payload = await this.extractAndValidateToken(authHeader);
    await this.authService.verify2FA(payload.sub, dto.code);
    return { success: true, message: 'Two-factor authentication enabled successfully' };
  }

  @Post('2fa/login')
  @HttpCode(HttpStatus.OK)
  async login2FA(@Body() dto: TwoFactorLoginDto) {
    const tokens = await this.authService.loginWith2FA(dto.tempToken, dto.code);
    return { success: true, data: tokens };
  }

  @Post('2fa/disable')
  @HttpCode(HttpStatus.OK)
  async disable2FA(
    @Headers('authorization') authHeader: string,
    @Body() dto: TwoFactorDisableDto,
  ) {
    const payload = await this.extractAndValidateToken(authHeader);
    await this.authService.disable2FA(payload.sub, dto.code);
    return { success: true, message: 'Two-factor authentication disabled successfully' };
  }

  @Post('2fa/backup-codes')
  @HttpCode(HttpStatus.OK)
  async regenerateBackupCodes(
    @Headers('authorization') authHeader: string,
    @Body() dto: TwoFactorBackupCodesDto,
  ) {
    const payload = await this.extractAndValidateToken(authHeader);
    const backupCodes = await this.authService.regenerateBackupCodes(payload.sub, dto.code);
    return { success: true, data: { backupCodes } };
  }

  // --- Private helpers ---

  private async extractAndValidateToken(authHeader: string) {
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('No token provided');
    }
    const token = authHeader.slice(7);
    return this.authService.validateToken(token);
  }
}
