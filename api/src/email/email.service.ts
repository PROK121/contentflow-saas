import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';
import {
  EmailTemplateInput,
  renderEmailHtml,
  renderEmailText,
} from './email-templates';

/// Параметры одного email-сообщения.
export interface SendEmailInput {
  to: string;
  subject: string;
  /// Простой текст письма (всегда отдаётся, даже если есть html — для клиентов
  /// без HTML).
  text: string;
  /// Опциональный html. Если не указан — используем text как plain.
  html?: string;
  /// Заголовки логирования: какой именно сценарий породил письмо
  /// (`magic-link`, `holder-invite`, `contract-sent`, ...). Пишем в логах
  /// для упрощения debug в проде.
  category: string;
  /// Опционально — id связанной сущности (User/Contract/Invite),
  /// чтобы метрики можно было фильтровать.
  entityId?: string;
}

/// EmailService — единая точка отправки писем.
///
/// Дизайн-решения:
/// 1. Если `SMTP_URL` не задан, переходим в console-режим: письма не уходят,
///    а полностью логируются в stdout. Это нужно для dev и для деплоев,
///    где SMTP ещё не подключён, чтобы основные потоки (invite/magic-link/sign)
///    не падали.
/// 2. Отправка best-effort: ошибки SMTP логируются, но не пробрасываются.
///    Логика бизнес-операций (приём инвайта, создание запроса материалов)
///    не должна валиться из-за временного сбоя почтового сервера.
/// 3. `FROM` берём из `EMAIL_FROM` или, как fallback,
///    `noreply@${parse(WEB_ORIGIN).host}` или просто `noreply@growix.local`.
@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter | null = null;
  private fromAddress = 'noreply@growix.local';

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    const smtpUrl = this.config.get<string>('SMTP_URL');
    const explicitFrom = this.config.get<string>('EMAIL_FROM');
    const webOrigin = this.config.get<string>('WEB_ORIGIN') || '';

    if (explicitFrom) {
      this.fromAddress = explicitFrom;
    } else {
      try {
        if (webOrigin) {
          const u = new URL(webOrigin);
          this.fromAddress = `noreply@${u.host.replace(/:\d+$/, '')}`;
        }
      } catch {
        // оставляем дефолт
      }
    }

    if (smtpUrl) {
      try {
        this.transporter = nodemailer.createTransport(smtpUrl);
        this.logger.log(
          `EmailService: SMTP ready (from=${this.fromAddress})`,
        );
      } catch (e) {
        this.logger.error(
          `EmailService: failed to create SMTP transport: ${
            e instanceof Error ? e.message : String(e)
          }. Falling back to console.`,
        );
        this.transporter = null;
      }
    } else {
      this.logger.log(
        `EmailService: SMTP_URL not set — running in CONSOLE mode (from=${this.fromAddress}). All emails are logged but not sent.`,
      );
    }
  }

  /// Отправка письма. Не бросает — ошибки логируются.
  async send(input: SendEmailInput): Promise<{ ok: boolean; mode: 'smtp' | 'console' }>{
    if (!this.transporter) {
      this.logger.log(
        `[EMAIL/${input.category}] -> ${input.to}\nSubject: ${input.subject}\n---\n${input.text}\n---`,
      );
      return { ok: true, mode: 'console' };
    }
    try {
      await this.transporter.sendMail({
        from: this.fromAddress,
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html,
      });
      this.logger.log(
        `[EMAIL/${input.category}] sent ok -> ${input.to}${
          input.entityId ? ` (entity=${input.entityId})` : ''
        }`,
      );
      return { ok: true, mode: 'smtp' };
    } catch (e) {
      this.logger.error(
        `[EMAIL/${input.category}] FAILED -> ${input.to}: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
      return { ok: false, mode: 'smtp' };
    }
  }

  /// Высокоуровневый шорткат: рендерит шаблон в html+text и зовёт `send`.
  /// Используется большинством сценариев (magic-link, invite, contract-signed
  /// и т.д.) вместо ручной сборки текста.
  async sendTemplated(input: {
    to: string;
    subject: string;
    category: string;
    entityId?: string;
    template: EmailTemplateInput;
    /// Если true — перед отправкой проверим
    /// `User.metadata.notificationsEnabled` для адресата (по email) и не будем
    /// слать, если пользователь явно отписался. Транзакционные письма
    /// (magic-link, invite, sign-confirmation) шлются всегда — для них
    /// `respectUserPrefs` не передаём.
    respectUserPrefs?: boolean;
  }): Promise<{ ok: boolean; mode: 'smtp' | 'console' | 'skipped' }> {
    if (input.respectUserPrefs) {
      const optedOut = await this.isOptedOut(input.to);
      if (optedOut) {
        this.logger.log(
          `[EMAIL/${input.category}] skipped (user opted out) -> ${input.to}`,
        );
        return { ok: true, mode: 'skipped' };
      }
    }
    const html = renderEmailHtml(input.template);
    const text = renderEmailText(input.template);
    return this.send({
      to: input.to,
      subject: input.subject,
      category: input.category,
      entityId: input.entityId,
      text,
      html,
    });
  }

  /// Проверяет, не отписался ли пользователь от уведомлений.
  /// Если письма уходят на email, не привязанный к User — возвращаем false
  /// (внешний правообладатель ещё не подключился — шлём всегда).
  private async isOptedOut(emailAddr: string): Promise<boolean> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { email: emailAddr.toLowerCase() },
        select: { metadata: true },
      });
      if (!user) return false;
      const meta = user.metadata as
        | { notificationsEnabled?: boolean }
        | null
        | undefined;
      if (meta && meta.notificationsEnabled === false) return true;
      return false;
    } catch {
      return false;
    }
  }

  /// Хелпер: безопасный абсолютный URL до фронта. Если WEB_ORIGIN не задан —
  /// возвращаем относительный путь (письмо всё равно лучше отправить).
  buildWebUrl(pathWithLeadingSlash: string): string {
    const origin = (this.config.get<string>('WEB_ORIGIN') || '').replace(
      /\/+$/,
      '',
    );
    return origin
      ? `${origin}${pathWithLeadingSlash}`
      : pathWithLeadingSlash;
  }
}
