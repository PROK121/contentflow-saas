import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import type { Request } from 'express';
import type { AuthUserView } from './auth-user.types';
import { ROLES_METADATA_KEY } from './roles.decorator';

/// Глобальный guard «default-deny»: если на контроллер/метод НЕ навесили
/// `@Roles(...)`, гард отказывает в доступе. Это страхует от ситуации,
/// когда новый контроллер забыли отметить ролью и он автоматически
/// оказался публичным для любого аутентифицированного пользователя
/// (включая `rights_owner`/`client`).
///
/// Маршруты, помеченные как public в `JwtAuthGuard.isPublicRoute`,
/// сюда не попадают вовсе (JwtAuthGuard уже вернул `true`).
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const user = req.user as AuthUserView | undefined;
    if (!user) {
      // Если JwtAuthGuard пропустил публичный маршрут — `req.user` пуст,
      // и здесь не место решать про роли. Считаем что разрешено.
      return true;
    }

    const allowed = this.reflector.getAllAndOverride<UserRole[] | undefined>(
      ROLES_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Default-deny: без явного декоратора — закрыто.
    if (!allowed || allowed.length === 0) {
      throw new ForbiddenException(
        'Эндпоинт не объявил список разрешённых ролей',
      );
    }

    if (!allowed.includes(user.role)) {
      throw new ForbiddenException(
        `Недостаточно прав: требуется одна из ролей ${allowed.join(', ')}`,
      );
    }
    return true;
  }
}
