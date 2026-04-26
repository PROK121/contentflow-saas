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
  /// Display-name отправителя для поля From. Используется в «обычном» режиме,
  /// когда mailbox жёстко зашит в EMAIL_FROM (без relay). Получатель видит:
  ///   From: "manager@growixcontent.com через Growix Content" <info@growixcontent.com>
  /// В relay-режиме (EMAIL_SENDER_OVERRIDE=true) display-name не используется,
  /// потому что mailbox перезаписывается на email менеджера и так уже виден.
  fromName?: string;
  /// Полная подмена envelope-from. Работает ТОЛЬКО когда сервис запущен в
  /// relay-режиме (EMAIL_SENDER_OVERRIDE=true) и SMTP-сервер разрешает
  /// отправку от любого адреса домена. Пример: Google Workspace SMTP Relay
  /// с «Allowed senders: Only addresses in my domains» — тогда мы логинимся
  /// одним служебным аккаунтом (info@growixcontent.com), а в From ставим
  /// личный адрес менеджера, инициировавшего действие. Получатель видит
  /// именно его, без приписки «через сервис», DKIM/SPF подписаны Google'ом
  /// от имени домена.
  ///
  /// Если override-режим выключен — это поле игнорируется, и используется
  /// служебный mailbox + display-name. Безопасный фолбэк.
  fromAddress?: string;
  /// Куда придёт ответ, если получатель нажмёт «Reply». В relay-режиме
  /// Reply-To избыточен (From уже = личной почте менеджера), но передавать
  /// безопасно — сервис сам не будет его дублировать.
  replyTo?: string;
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
  /// Email-адрес отправителя (mailbox) — должен принадлежать домену, под
  /// который настроены SPF/DKIM/DMARC. Не путать с display-name.
  private fromAddress = 'noreply@growix.local';
  /// Дефолтное display-name бренда — отображается, когда у конкретного
  /// письма не задан собственный fromName.
  private defaultFromName = 'Growix Content';
  /// Включает relay-режим: для конкретного письма можно указать произвольный
  /// envelope-from в пределах нашего домена (см. SendEmailInput.fromAddress).
  /// Включается env-переменной EMAIL_SENDER_OVERRIDE=true и требует SMTP-
  /// сервера, который это разрешает (Google Workspace SMTP Relay).
  private senderOverrideEnabled = false;
  /// Список доменов, для которых SMTP-сервер разрешает relay (envelope-from).
  /// Заполняется из служебного mailbox (EMAIL_FROM) и дополнительной env
  /// EMAIL_RELAY_DOMAINS (через запятую). Если адрес инициатора не попадает
  /// в этот список — override игнорируется и письмо уходит со служебного
  /// mailbox (типичный кейс: правообладатель с почтой gmail.com).
  private relayDomains = new Set<string>();

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    const smtpUrl = this.config.get<string>('SMTP_URL');
    const explicitFrom = this.config.get<string>('EMAIL_FROM');
    const explicitFromName = this.config.get<string>('EMAIL_FROM_NAME');
    const webOrigin = this.config.get<string>('WEB_ORIGIN') || '';
    const senderOverride =
      this.config.get<string>('EMAIL_SENDER_OVERRIDE') || '';
    this.senderOverrideEnabled =
      senderOverride.toLowerCase() === 'true' ||
      senderOverride === '1' ||
      senderOverride.toLowerCase() === 'yes';

    if (explicitFromName) {
      this.defaultFromName = explicitFromName;
    }

    if (explicitFrom) {
      // EMAIL_FROM может быть либо «чистым» адресом (noreply@growixcontent.com),
      // либо в формате «Name <addr>». Парсим аккуратно: если есть угловые
      // скобки — берём то, что внутри, и используем подпись как defaultFromName.
      const m = /^\s*(?:"?([^"<]+?)"?\s*)?<([^>]+)>\s*$/.exec(explicitFrom);
      if (m) {
        if (m[1]) this.defaultFromName = m[1].trim();
        this.fromAddress = m[2].trim();
      } else {
        this.fromAddress = explicitFrom.trim();
      }
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

    // Список доменов, разрешённых для override. По умолчанию — домен
    // служебного mailbox. Дополнительно можно перечислить через
    // EMAIL_RELAY_DOMAINS=growixcontent.com,othercorp.kz.
    const baseDomain = this.fromAddress.split('@')[1]?.toLowerCase().trim();
    if (baseDomain) this.relayDomains.add(baseDomain);
    const extraDomains = this.config.get<string>('EMAIL_RELAY_DOMAINS') || '';
    for (const d of extraDomains.split(',').map((s) => s.trim().toLowerCase())) {
      if (d) this.relayDomains.add(d);
    }

    if (smtpUrl) {
      try {
        this.transporter = nodemailer.createTransport(smtpUrl);
        this.logger.log(
          `EmailService: SMTP ready (from="${this.defaultFromName}" <${this.fromAddress}>, sender-override=${this.senderOverrideEnabled}, relay-domains=[${[...this.relayDomains].join(',')}])`,
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
        `EmailService: SMTP_URL not set — running in CONSOLE mode (from="${this.defaultFromName}" <${this.fromAddress}>, sender-override=${this.senderOverrideEnabled}). All emails are logged but not sent.`,
      );
    }
  }

  private isAllowedRelayDomain(emailAddr: string): boolean {
    const domain = emailAddr.split('@')[1]?.toLowerCase().trim();
    if (!domain) return false;
    return this.relayDomains.has(domain);
  }

  /// Сборка финального display-name. Sanitize: убираем угловые скобки и
  /// двойные кавычки, чтобы корректно встроиться в RFC-5322 заголовок.
  /// Если имя совпадает с base — не дублируем «Имя через Бренд».
  private composeFromName(custom: string | undefined): string {
    const base = this.defaultFromName;
    const safe = (s: string) => s.replace(/[<>"]/g, '').trim();
    if (!custom) return base;
    const c = safe(custom);
    if (!c) return base;
    if (c === base) return base;
    return `${c} через ${base}`;
  }

  /// Отправка письма. Не бросает — ошибки логируются.
  async send(input: SendEmailInput): Promise<{ ok: boolean; mode: 'smtp' | 'console' }>{
    // В relay-режиме envelope-from подменяем на адрес инициатора (если он
    // в нашем домене и SMTP-сервер это разрешает). В обычном — display-name
    // подставляется к служебному mailbox'у.
    const useOverride =
      this.senderOverrideEnabled &&
      !!input.fromAddress &&
      isLikelyEmail(input.fromAddress) &&
      this.isAllowedRelayDomain(input.fromAddress);

    let fromHeader: string | { name: string; address: string };
    if (useOverride) {
      // Чистый From без display-name: получатель видит ровно email менеджера.
      fromHeader = input.fromAddress as string;
    } else {
      fromHeader = {
        name: this.composeFromName(input.fromName),
        address: this.fromAddress,
      };
    }

    if (!this.transporter) {
      const fromStr =
        typeof fromHeader === 'string'
          ? fromHeader
          : `"${fromHeader.name}" <${fromHeader.address}>`;
      const replyHint = input.replyTo ? `\nReply-To: ${input.replyTo}` : '';
      this.logger.log(
        `[EMAIL/${input.category}] -> ${input.to}\nFrom: ${fromStr}${replyHint}\nSubject: ${input.subject}\n---\n${input.text}\n---`,
      );
      return { ok: true, mode: 'console' };
    }
    try {
      await this.transporter.sendMail({
        from: fromHeader,
        to: input.to,
        replyTo: input.replyTo,
        subject: input.subject,
        text: input.text,
        html: input.html,
      });
      const fromStr =
        typeof fromHeader === 'string' ? fromHeader : fromHeader.address;
      this.logger.log(
        `[EMAIL/${input.category}] sent ok -> ${input.to} (from=${fromStr})${
          input.entityId ? ` (entity=${input.entityId})` : ''
        }${input.replyTo ? ` (reply-to=${input.replyTo})` : ''}`,
      );
      return { ok: true, mode: 'smtp' };
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      // Если override-режим попал в политику SMTP-сервера (типичные коды
      // Gmail Relay: 550 5.7.1 / 550 5.7.0 / 553 / 535 при попытке поставить
      // чужой envelope-from) — повторяем со служебным mailbox. Письмо всё
      // равно дойдёт, только в From будет служебный адрес + display-name.
      if (useOverride && isLikelySenderRejection(errMsg)) {
        this.logger.warn(
          `[EMAIL/${input.category}] override rejected (${errMsg}) — retrying with service mailbox`,
        );
        try {
          await this.transporter.sendMail({
            from: {
              name: this.composeFromName(input.fromName),
              address: this.fromAddress,
            },
            to: input.to,
            replyTo: input.replyTo ?? input.fromAddress,
            subject: input.subject,
            text: input.text,
            html: input.html,
          });
          this.logger.log(
            `[EMAIL/${input.category}] sent ok (fallback) -> ${input.to} (from=${this.fromAddress})${
              input.entityId ? ` (entity=${input.entityId})` : ''
            }`,
          );
          return { ok: true, mode: 'smtp' };
        } catch (e2) {
          this.logger.error(
            `[EMAIL/${input.category}] FAILED (fallback) -> ${input.to}: ${
              e2 instanceof Error ? e2.message : String(e2)
            }`,
          );
          return { ok: false, mode: 'smtp' };
        }
      }
      this.logger.error(
        `[EMAIL/${input.category}] FAILED -> ${input.to}: ${errMsg}`,
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
    /// См. `SendEmailInput.fromName` — display-name отправителя.
    fromName?: string;
    /// См. `SendEmailInput.fromAddress` — подмена envelope-from в relay-режиме.
    fromAddress?: string;
    /// См. `SendEmailInput.replyTo` — куда придёт «Ответить».
    replyTo?: string;
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
      fromName: input.fromName,
      fromAddress: input.fromAddress,
      replyTo: input.replyTo,
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

/// Минимальная валидация email — нужна, чтобы случайно не передать в From
/// пустую строку или мусор (это вызовет 5xx от SMTP-сервера).
function isLikelyEmail(s: string): boolean {
  if (!s) return false;
  const trimmed = s.trim();
  return /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(trimmed);
}

/// Распознаёт SMTP-ошибки, связанные с подменой From: relay-policy reject,
/// «sender not allowed», auth misalignment. На таких ошибках имеет смысл
/// сделать retry со служебным mailbox.
function isLikelySenderRejection(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    m.includes('5.7.1') ||
    m.includes('5.7.0') ||
    m.includes('not allowed') ||
    m.includes('sender mismatch') ||
    m.includes('sender address rejected') ||
    m.includes('does not match authenticated user') ||
    m.includes('domain of sender address') ||
    m.includes('mail from address must match') ||
    /^5\d\d\b/.test(m) && m.includes('from')
  );
}
