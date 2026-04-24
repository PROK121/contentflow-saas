import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';

function normalizePath(req: Request): string {
  const raw = req.originalUrl ?? req.url;
  return raw.split('?')[0] ?? '';
}

const isProduction = process.env.NODE_ENV === 'production';

function isPublicRoute(path: string, method: string): boolean {
  if (method === 'POST' && path.endsWith('/auth/login')) return true;
  if (method === 'GET' && path.endsWith('/health')) return true;
  // /debug/* публичен только вне прода; на проде требует JWT.
  if (!isProduction && method === 'GET' && path.includes('/debug/')) return true;
  return false;
}

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    /**
     * E2E: `DISABLE_API_AUTH=1` отключает проверку JWT (см. test/deals.e2e-spec.ts).
     * На проде чёрный ход заблокирован независимо от значения переменной.
     */
    if (!isProduction && process.env.DISABLE_API_AUTH === '1') return true;
    const req = context.switchToHttp().getRequest<Request>();
    const path = normalizePath(req);
    if (isPublicRoute(path, req.method)) return true;
    return super.canActivate(context);
  }
}
