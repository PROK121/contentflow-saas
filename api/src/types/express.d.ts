import type { AuthUserView } from '../auth/auth-user.types';

declare global {
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface User extends AuthUserView {}
  }
}

export {};
