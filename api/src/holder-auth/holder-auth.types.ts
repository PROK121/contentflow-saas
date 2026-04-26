import type { UserRole } from '@prisma/client';

/// Полезная нагрузка инвайта, скрытая в URL-параметре.
/// Сам токен — base64url(rawToken). На сервере мы сравниваем sha256(rawToken)
/// со значением tokenHash в БД, чтобы plain-токены никогда не попадали в логи.
export interface HolderInvitePreview {
  email: string;
  organization: {
    id: string;
    legalName: string;
  };
  invitedBy: {
    displayName: string | null;
    email: string;
  };
  expiresAt: Date;
  /// true если инвайт уже принят и можно сразу логиниться по email (на этом
  /// токене нельзя сделать второй claim).
  alreadyConsumed: boolean;
}

export interface HolderClaimResult {
  accessToken: string;
  user: {
    id: string;
    email: string;
    role: UserRole;
    displayName: string | null;
    organizationId: string | null;
    locale: string;
    acceptedTermsAt: Date | null;
  };
}
