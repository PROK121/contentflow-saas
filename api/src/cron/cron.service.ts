import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { TaskPriority, TaskStatus, TaskType } from '@prisma/client';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';

/// Лёгкий cron на нативном `setInterval`. Без `@nestjs/schedule` —
/// чтобы не тащить новую зависимость на CI/прод. Когда понадобится
/// надёжный распределённый cron (несколько инстансов), переходим на
/// BullMQ или `@nestjs/schedule` + advisory lock в Postgres.
///
/// Текущие jobs:
///   • email-retry: каждые 5 минут пробует доставить письма со статусом
///     `failed` (attempts < 3). См. EmailService.retryFailed.
///   • tax-cert-expiry: раз в 24 часа сканирует TaxProfile.validUntil,
///     создаёт Task менеджеру за 30 дней до истечения сертификата ДВН.
///     Дублирование Task защищается уникальностью по
///     (linkedEntityType='taxProfile', linkedEntityId, type='custom').
@Injectable()
export class CronService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CronService.name);
  private timers: NodeJS.Timeout[] = [];

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  onModuleInit() {
    // В тестах cron не нужен.
    if (process.env.NODE_ENV === 'test') return;
    if (process.env.DISABLE_CRON === '1') {
      this.logger.log('Cron disabled by DISABLE_CRON=1');
      return;
    }

    // Запускаем сразу при старте + по интервалу.
    void this.runEmailRetry();
    void this.runTaxCertExpiry();

    // Email retry — каждые 5 минут.
    this.timers.push(
      setInterval(() => void this.runEmailRetry(), 5 * 60 * 1000),
    );
    // Tax certificate expiry — раз в 24 часа.
    this.timers.push(
      setInterval(() => void this.runTaxCertExpiry(), 24 * 60 * 60 * 1000),
    );

    this.logger.log(
      'CronService started (email-retry every 5m, tax-cert-expiry daily)',
    );
  }

  onModuleDestroy() {
    for (const t of this.timers) clearInterval(t);
  }

  private async runEmailRetry() {
    try {
      const n = await this.email.retryFailed(3, 50);
      if (n > 0) {
        this.logger.log(`email-retry: re-sent ${n} message(s)`);
      }
    } catch (e) {
      this.logger.warn(
        `email-retry failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  /// Создаёт Task для менеджера за 30 дней до истечения сертификата
  /// резидентности (`TaxProfile.validUntil`). Если Task на эту запись уже
  /// был создан — повторно не плодим. Это нужно для compliance: без
  /// действующего сертификата нельзя применять льготную ставку по ДВН,
  /// и юрист должен заранее запросить новый документ у правообладателя.
  private async runTaxCertExpiry() {
    try {
      const now = new Date();
      const horizon = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      // Кандидаты: профили с истекающим сертификатом в ближайшие 30 дней,
      // а также с уже истекшим (validUntil < now), но всё ещё помеченным
      // dtCertificatePresent=true — это аномалия, которую тоже надо подсветить.
      const profiles = await this.prisma.taxProfile.findMany({
        where: {
          dtCertificatePresent: true,
          validUntil: { not: null, lte: horizon },
        },
        select: {
          id: true,
          jurisdiction: true,
          validUntil: true,
          organizationId: true,
          organization: { select: { legalName: true } },
        },
      });

      if (profiles.length === 0) return;

      // Подбираем активного менеджера для назначения. Логика проще, чем
      // в proposeTitle: первый активный admin/manager — этот cron
      // запускается редко, и ровного распределения не требуется.
      const assignee = await this.prisma.user.findFirst({
        where: { role: { in: ['admin', 'manager'] } },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      if (!assignee) {
        this.logger.warn(
          'tax-cert-expiry: нет активных менеджеров для назначения задач',
        );
        return;
      }

      let createdCount = 0;
      for (const p of profiles) {
        // Проверяем, есть ли уже открытая Task на этот профиль —
        // защита от дубликатов между запусками.
        const existing = await this.prisma.task.findFirst({
          where: {
            linkedEntityType: 'taxProfile',
            linkedEntityId: p.id,
            archived: false,
            status: { not: TaskStatus.done },
          },
          select: { id: true },
        });
        if (existing) continue;

        const orgName = p.organization?.legalName ?? p.organizationId;
        const validUntilStr = p.validUntil
          ? p.validUntil.toISOString().slice(0, 10)
          : '—';
        const isExpired =
          p.validUntil != null && p.validUntil.getTime() < now.getTime();

        await this.prisma.task.create({
          data: {
            assigneeId: assignee.id,
            dueAt: p.validUntil ?? new Date(now.getTime() + 7 * 86400000),
            type: TaskType.custom,
            status: TaskStatus.todo,
            priority: isExpired ? TaskPriority.high : TaskPriority.medium,
            linkedEntityType: 'taxProfile',
            linkedEntityId: p.id,
            title: isExpired
              ? `Сертификат резидентства просрочен: ${orgName} (${p.jurisdiction})`
              : `Истекает сертификат резидентства: ${orgName} (${p.jurisdiction}, до ${validUntilStr})`,
            description:
              `Сертификат ДВН по контрагенту ${orgName} (${p.jurisdiction}) ${isExpired ? 'уже не действителен' : `истекает ${validUntilStr}`}. ` +
              `Без действительного сертификата льготная ставка по ДВН применяться не должна — ` +
              `запросите у правообладателя обновлённый документ или согласуйте перевод на базовую ставку.`,
          },
        });
        createdCount++;
      }
      if (createdCount > 0) {
        this.logger.log(
          `tax-cert-expiry: созданы задачи по ${createdCount} налоговым профилям`,
        );
      }
    } catch (e) {
      this.logger.warn(
        `tax-cert-expiry failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
}
