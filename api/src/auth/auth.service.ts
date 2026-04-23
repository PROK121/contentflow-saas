import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUserView } from './auth-user.types';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(
    dto: LoginDto,
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
        createdAt: true,
        updatedAt: true,
        passwordHash: true,
      },
    });
    if (!user?.passwordHash) {
      throw new UnauthorizedException('Неверный email или пароль');
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Неверный email или пароль');
    }
    const { passwordHash: _p, ...safe } = user;
    const payload = { sub: safe.id, email: safe.email, role: safe.role };
    const accessToken = await this.jwt.signAsync(payload);
    return { accessToken, user: safe };
  }
}
