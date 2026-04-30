import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUserView } from './auth-user.types';
import { LoginDto } from './dto/login.dto';

/// Полезная нагрузка JWT.
/// `tv` — текущая `User.tokenVersion` на момент выпуска. На каждом запросе
/// `JwtStrategy.validate` сравнивает её с актуальной — несовпадение
/// (logout-all, бан, смена пароля) отвергает токен.
export interface CfJwtPayload {
  sub: string;
  email: string;
  role: string;
  tv: number;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(
    dto: LoginDto,
    ip?: string,
  ): Promise<{ accessToken: string; user: AuthUserView }> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        role: true,
        displayName: true,
        organizationId: true,
        locale: true,
        acceptedTermsAt: true,
        createdAt: true,
        updatedAt: true,
        passwordHash: true,
        tokenVersion: true,
      },
    });
    if (!user?.passwordHash) {
      throw new UnauthorizedException('Неверный email или пароль');
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Неверный email или пароль');
    }

    // Учёт последнего входа — полезно для аудита и подозрительной активности.
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), lastLoginIp: ip ?? null },
    });

    const { passwordHash: _p, tokenVersion, ...safe } = user;
    const payload: CfJwtPayload = {
      sub: safe.id,
      email: safe.email,
      role: safe.role,
      tv: tokenVersion,
    };
    const accessToken = await this.jwt.signAsync(payload);
    return { accessToken, user: safe };
  }

  /// Инкрементирует `User.tokenVersion`, что инвалидирует все ранее
  /// выпущенные JWT. Используется в logout-all и при смене пароля.
  async bumpTokenVersion(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
    });
  }
}
