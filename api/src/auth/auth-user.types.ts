import type { UserRole } from '@prisma/client';

export interface AuthUserView {
  id: string;
  email: string;
  role: UserRole;
  displayName: string | null;
  organizationId: string | null;
  locale: string;
  createdAt: Date;
  updatedAt: Date;
}
