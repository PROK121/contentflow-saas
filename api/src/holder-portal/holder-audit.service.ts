import { Injectable, Logger } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUserView } from '../auth/auth-user.types';
import { PrismaService } from '../prisma/prisma.service';

/// Машиночитаемые названия действий правообладателя.
/// Используются в HolderAuditLog.action и сверяются на фронте при показе журнала.
export type HolderAuditAction =
  | 'login_password'
  | 'login_magic'
  | 'invite_claimed'
  | 'view_dashboard'
  | 'view_catalog_item'
  | 'view_deal'
  | 'view_payout'
  | 'view_contract'
  | 'download_contract'
  | 'sign_contract'
  | 'upload_material'
  | 'propose_catalog_item'
  | 'update_profile'
  | 'logout';

interface AuditPayload {
  user: AuthUserView;
  action: HolderAuditAction;
  entityType?: string;
  entityId?: string;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class HolderAuditService {
  private readonly logger = new Logger(HolderAuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /// Лог критичного действия. Не блокирует основной поток — ошибки
  /// логирования не должны рушить пользовательский запрос.
  async log(payload: AuditPayload): Promise<void> {
    if (!payload.user.organizationId) return;
    try {
      await this.prisma.holderAuditLog.create({
        data: {
          userId: payload.user.id,
          organizationId: payload.user.organizationId,
          action: payload.action,
          entityType: payload.entityType ?? null,
          entityId: payload.entityId ?? null,
          ip: payload.ip ?? null,
          userAgent: payload.userAgent ?? null,
          metadata: (payload.metadata as object | undefined) ?? undefined,
        },
      });
    } catch (e) {
      this.logger.warn(
        `Failed to write holder audit log (${payload.action}): ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
    }
  }

  /// Хелпер: достать ip и user-agent из request объекта.
  static fromRequest(req: Request): { ip?: string; userAgent?: string } {
    const ua = req.headers['user-agent'];
    return {
      ip: req.ip || undefined,
      userAgent: typeof ua === 'string' ? ua.slice(0, 500) : undefined,
    };
  }
}
