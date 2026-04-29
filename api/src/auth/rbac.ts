import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { Request } from 'express';
import type { AuthUserView } from './auth-user.types';

export function requireAuthUser(req: Request): AuthUserView {
  const me = req.user as AuthUserView | undefined;
  if (!me) throw new BadRequestException('Auth required');
  return me;
}

export function assertManagerOrAdmin(req: Request): AuthUserView {
  const me = requireAuthUser(req);
  if (me.role !== UserRole.admin && me.role !== UserRole.manager) {
    throw new ForbiddenException('Недостаточно прав: нужна роль менеджера');
  }
  return me;
}
