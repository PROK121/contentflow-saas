import { ForbiddenException } from '@nestjs/common';
import type { AuthUserView } from './auth-user.types';

/** Единственный аккаунт с правом безвозвратного удаления сущностей из архива. */
export function getAdminDeleteEmail(): string {
  return (
    process.env.ADMIN_DELETE_EMAIL?.trim().toLowerCase() ||
    'info@growixcontent.com'
  );
}

export function assertAdminDeleteUser(user: AuthUserView | undefined): void {
  if (!user?.email) {
    throw new ForbiddenException('Доступ запрещён');
  }
  const allowed = getAdminDeleteEmail();
  if (user.email.trim().toLowerCase() !== allowed) {
    throw new ForbiddenException(
      'Безвозвратное удаление доступно только администратору',
    );
  }
}
