import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import type { AuthUserView } from '../auth/auth-user.types';
import { EmailService } from '../email/email.service';
import {
  ClaimInviteDto,
  CreateInviteDto,
  RequestMagicLinkDto,
  VerifyMagicLinkDto,
} from './dto';
import { HolderAuthService } from './holder-auth.service';

function clientIp(req: Request): string | undefined {
  // Express после `app.set('trust proxy', 1)` корректно ставит req.ip.
  // На Render это уже сделано в main.ts.
  return req.ip || undefined;
}

/// Endpoints вынесены под /v1/auth/holder/* для логического разделения
/// с менеджерским логином /v1/auth/login.
@Controller('auth/holder')
export class HolderAuthController {
  constructor(
    private readonly auth: HolderAuthService,
    private readonly email: EmailService,
  ) {}

  // -------------------------------------------------------------------------
  // Менеджер: создаёт инвайт. Требует JWT (используется глобальный JwtAuthGuard).
  // -------------------------------------------------------------------------
  @Post('invites')
  @HttpCode(HttpStatus.CREATED)
  async createInvite(@Body() dto: CreateInviteDto, @Req() req: Request) {
    const me = req.user as AuthUserView | undefined;
    if (!me) throw new BadRequestException('Auth required');
    const result = await this.auth.createInvite(me.id, me.role, dto);

    // Отправляем приглашение по email best-effort. Если SMTP не настроен,
    // письмо попадёт в логи (см. EmailService console-режим), а менеджер
    // дополнительно получает `acceptUrl` в ответе и может прислать ссылку
    // вручную (мессенджер/Slack).
    const acceptUrl = this.email.buildWebUrl(
      `/holder/accept?token=${encodeURIComponent(result.rawToken)}`,
    );
    void this.email.sendTemplated({
      to: dto.email,
      category: 'holder-invite',
      subject: 'Приглашение в кабинет правообладателя GROWIX',
      entityId: result.inviteId,
      fromName: me.email,
      fromAddress: me.email,
      replyTo: me.email,
      template: {
        title: 'Вас пригласили в кабинет правообладателя',
        preheader: `${me.email} открыл(а) вам доступ в GROWIX`,
        paragraphs: [
          'Здравствуйте!',
          `<strong>${me.email}</strong> открыл(а) для вас доступ в кабинет правообладателя GROWIX. В нём вы сможете отслеживать сделки, выплаты, договоры и присылать материалы.`,
          'Срок действия ссылки — 7 дней. Используйте её один раз.',
        ],
        cta: { label: 'Принять приглашение', url: acceptUrl },
        ctaNote:
          'Если кнопка не работает, скопируйте и вставьте ссылку в браузер вручную. По любым вопросам ответьте на это письмо — оно придёт менеджеру.',
      },
    });

    // Возвращаем сырой токен ровно один раз — клиент должен либо сразу
    // использовать его (отправить письмо), либо показать менеджеру для
    // ручной отправки. В БД хранится только sha256-хеш.
    return { ...result, acceptUrl };
  }

  /// Менеджерский список инвайтов и активных правообладателей по организации.
  @Get('invites')
  async listInvites(@Query('orgId') orgId?: string) {
    if (!orgId) throw new BadRequestException('orgId is required');
    return this.auth.listOrgInvites(orgId);
  }

  // -------------------------------------------------------------------------
  // Правообладатель: проверяет инвайт перед заполнением формы.
  // Публичный endpoint (доступен без auth) — добавлен в jwt-auth.guard.
  // -------------------------------------------------------------------------
  @Get('invites/preview')
  @SkipThrottle({ login: true })
  async previewInvite(@Query('token') token?: string) {
    if (!token || token.length < 8) {
      throw new BadRequestException('Token is required');
    }
    return this.auth.previewInvite(token);
  }

  // -------------------------------------------------------------------------
  // Правообладатель: принимает инвайт + onboarding-данные.
  // Публичный endpoint, защищён throttler'ом и одноразовостью токена.
  // -------------------------------------------------------------------------
  @Post('invites/claim')
  @Throttle({ login: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  async claimInvite(@Body() dto: ClaimInviteDto, @Req() req: Request) {
    return this.auth.claimInvite(dto, clientIp(req));
  }

  // -------------------------------------------------------------------------
  // Magic-link: запрос ссылки на email.
  // Возвращает 200 даже если email не найден — чтобы нельзя было
  // энумерировать пользователей.
  // -------------------------------------------------------------------------
  @Post('magic-link/request')
  @Throttle({ login: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  async requestMagicLink(@Body() dto: RequestMagicLinkDto) {
    const link = await this.auth.requestMagicLink(dto);
    if (!link) {
      return { ok: true };
    }
    // Безопасный путь редиректа — только /holder/* и без protocol-relative.
    const safeRedirect =
      dto.redirect &&
      typeof dto.redirect === 'string' &&
      dto.redirect.startsWith('/holder') &&
      !dto.redirect.startsWith('//')
        ? dto.redirect
        : '/holder';

    const url = this.email.buildWebUrl(
      `/holder/auth/verify?token=${encodeURIComponent(
        link.token,
      )}&next=${encodeURIComponent(safeRedirect)}`,
    );

    void this.email.sendTemplated({
      to: link.email,
      category: 'magic-link',
      subject: 'Вход в кабинет правообладателя GROWIX',
      entityId: link.email,
      template: {
        title: 'Вход в кабинет правообладателя',
        preheader: 'Одноразовая ссылка, действительна 15 минут',
        paragraphs: [
          'Вы запросили вход в кабинет GROWIX. Нажмите кнопку ниже, чтобы войти.',
          'Ссылка действительна <strong>15 минут</strong> и может быть использована один раз.',
        ],
        cta: { label: 'Войти в кабинет', url },
        ctaNote:
          'Если вы не запрашивали вход — просто проигнорируйте письмо. Никому не передавайте эту ссылку.',
      },
    });

    // В DEV/staging возвращаем готовую ссылку, чтобы тестировать QR-флоу
    // и magic-link без работающего SMTP. На проде — никогда: ссылка должна
    // приходить только в почтовый ящик владельца email.
    if (process.env.NODE_ENV !== 'production') {
      return { ok: true, magicUrl: url };
    }
    return { ok: true };
  }

  @Post('magic-link/verify')
  @Throttle({ login: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  async verifyMagicLink(@Body() dto: VerifyMagicLinkDto, @Req() req: Request) {
    return this.auth.verifyMagicLink(dto, clientIp(req));
  }
}
