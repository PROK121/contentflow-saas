import { ForbiddenException } from '@nestjs/common';
import type { AuthUserView } from './auth-user.types';

/** Право безвозвратного удаления есть у всех пользователей с ролью admin. */
export function assertAdminDeleteUser(user: AuthUserView | undefined): void {
  if (!user?.email) {
    throw new ForbiddenException('Доступ запрещён');
  }
  if (user.role !== 'admin') {
    throw new ForbiddenException(
      'Безвозвратное удаление доступно только администратору',
    );
  }
}
