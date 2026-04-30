import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

/// Ключ метаданных, под которым `RolesGuard` ищет список разрешённых ролей.
export const ROLES_METADATA_KEY = 'cf.roles';

/// Декоратор `@Roles('admin', 'manager')` ставится на контроллер или метод.
/// Без декоратора `RolesGuard` блокирует доступ всем ролям (default-deny).
/// Если нужен публично-аутентифицированный эндпоинт без ограничений по ролям —
/// явно ставим `@Roles('admin', 'manager', 'rights_owner', 'client')` или
/// `@AllowAnyAuthenticatedRole()` (см. ниже).
export const Roles = (...roles: UserRole[]) =>
  SetMetadata(ROLES_METADATA_KEY, roles);

/// Удобный шорткат для пуб-эндпоинтов, доступных любой роли при условии auth.
/// Например, `/v1/auth/me` — пользователь любой роли может посмотреть профиль.
export const AllowAnyAuthenticatedRole = () =>
  Roles('admin', 'manager', 'rights_owner', 'client');
