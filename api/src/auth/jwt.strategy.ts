import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUserView } from './auth-user.types';

const safeUserSelect = {
  id: true,
  email: true,
  role: true,
  displayName: true,
  organizationId: true,
  locale: true,
  createdAt: true,
  updatedAt: true,
} as const;

function jwtFromRequest(req: Request): string | null {
  const fromCookie = req?.cookies?.['cf_session'];
  if (typeof fromCookie === 'string' && fromCookie.length > 0)
    return fromCookie;
  return ExtractJwt.fromAuthHeaderAsBearerToken()(req);
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest,
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET') ?? 'dev-change-me',
    });
  }

  async validate(payload: { sub?: string }): Promise<AuthUserView> {
    const id = payload.sub;
    if (!id) throw new UnauthorizedException();
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: safeUserSelect,
    });
    if (!user) throw new UnauthorizedException();
    return user;
  }
}
