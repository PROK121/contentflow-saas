import { Injectable, Logger } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUserView } from '../auth/auth-user.types';
import { PrismaService } from '../prisma/prisma.service';

/// Машиночитаемые имена действий CRM-стороны.
/// Дополняются по мере появления новых сценариев. Жёсткий enum здесь
/// сознательно НЕ используем, чтобы можно было легко добавить новый
/// тип события без миграции БД.
export type CrmAuditAction =
  | 'contract.create'
  | 'contract.patch'
  | 'contract.archive'
  | 'contract.unarchive'
  | 'contract.send'
  | 'contract.mark_signed'
  | 'contract.delete'
  | 'deal.create'
  | 'deal.patch'
  | 'deal.archive'
  | 'deal.delete'
  | 'deal.duplicate'
  | 'offer.create'
  | 'offer.archive'
  | 'offer.delete'
  | 'offer.create_manual'
  | 'org.create'
  | 'org.holder_visibility_set'
  | 'org.holder_user_visibility_set'
  | 'org.contact_card_set'
  | 'payout.create'
  | 'payment.update'
  | 'material_request.create'
  | 'material_request.review'
  | 'material_request.cancel'
  | 'catalog.create'
  | 'catalog.patch'
  | 'catalog.delete';

interface AuditPayload {
  user: AuthUserView | undefined;
  action: CrmAuditAction;
  entityType?: string;
  entityId?: string;
  organizationId?: string;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

/// Сервис аудита для CRM-стороны (менеджер/админ). Аудит правообладателей
/// живёт в `HolderAuditService` — это раздельные журналы, чтобы можно было
/// показывать «историю действий» конкретной стороне без смешения.
///
/// Запись best-effort: сбой записи аудита не должен валить бизнес-операцию.
@Injectable()
export class CrmAuditService {
  private readonly logger = new Logger(CrmAuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(payload: AuditPayload): Promise<void> {
    if (!payload.user) return;
    try {
      await this.prisma.crmAuditLog.create({
        data: {
          userId: payload.user.id,
          action: payload.action,
          entityType: payload.entityType ?? null,
          entityId: payload.entityId ?? null,
          organizationId: payload.organizationId ?? null,
          ip: payload.ip ?? null,
          userAgent: payload.userAgent ?? null,
          metadata: (payload.metadata as object | undefined) ?? undefined,
        },
      });
    } catch (e) {
      this.logger.warn(
        `Failed to write CRM audit log (${payload.action}): ${
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
