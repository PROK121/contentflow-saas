import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import type { AuthUserView } from './auth-user.types';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { AllowAnyAuthenticatedRole } from './roles.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /// `/auth/login` — public route (см. JwtAuthGuard.isPublicRoute), сюда
  /// JWT не доходит, RolesGuard пропускает (req.user пуст).
  @Throttle({ login: { limit: 5, ttl: 60_000 } })
  @Post('login')
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.auth.login(dto, req.ip ?? undefined);
  }

  /// Профиль доступен любой аутентифицированной роли.
  @AllowAnyAuthenticatedRole()
  @Get('me')
  me(@Req() req: Request) {
    return { user: req.user as AuthUserView };
  }

  /// Logout — инкрементирует tokenVersion пользователя. Любая активная
  /// сессия будет отвергнута на следующем запросе.
  @AllowAnyAuthenticatedRole()
  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  async logoutAll(@Req() req: Request) {
    const user = req.user as AuthUserView | undefined;
    if (!user) return { ok: true };
    await this.auth.bumpTokenVersion(user.id);
    return { ok: true };
  }
}
