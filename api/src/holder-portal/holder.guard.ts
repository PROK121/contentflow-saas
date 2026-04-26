import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { Request } from 'express';
import type { AuthUserView } from '../auth/auth-user.types';

/// Гард для всех маршрутов /v1/holder/*. Требует, чтобы пользователь:
///  1) был аутентифицирован (через глобальный JwtAuthGuard выше по цепочке);
///  2) имел роль rights_owner;
///  3) был привязан к organizationId (без него скоуп невозможен).
///
/// Onboarding (acceptedTermsAt === null) тут НЕ блокируется на бэке —
/// фронт сам перенаправит на мастер. Но эндпоинты, требующие согласия
/// с условиями (например, скачивание договоров), могут отдельно проверить
/// `acceptedTermsAt` через помощник в сервисе.
@Injectable()
export class HolderGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const user = req.user as AuthUserView | undefined;
    if (!user) {
      throw new ForbiddenException('Auth required');
    }
    if (user.role !== UserRole.rights_owner) {
      throw new ForbiddenException(
        'Доступ к кабинету правообладателя имеют только пользователи с ролью rights_owner',
      );
    }
    if (!user.organizationId) {
      throw new ForbiddenException(
        'Пользователь не привязан к организации правообладателя',
      );
    }
    return true;
  }
}
