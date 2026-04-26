import type { UserRole } from '@prisma/client';

export interface AuthUserView {
  id: string;
  email: string;
  role: UserRole;
  displayName: string | null;
  organizationId: string | null;
  locale: string;
  /// Заполнено, если пользователь приглашён, но ещё не прошёл onboarding.
  /// Используется фронтом для редиректа на /holder/onboarding.
  acceptedTermsAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
