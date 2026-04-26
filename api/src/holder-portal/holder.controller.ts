import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { createReadStream, existsSync } from 'fs';
import type { Request } from 'express';
import type { AuthUserView } from '../auth/auth-user.types';
import { ContractsService } from '../contracts/contracts.service';
import { EmailService } from '../email/email.service';
import { MATERIAL_SLOTS } from '../material-requests/material-slots';
import { materialDiskStorage } from '../material-requests/material-storage';
import { MaterialRequestsService } from '../material-requests/material-requests.service';
import { PrismaService } from '../prisma/prisma.service';
import { HolderAuditService } from './holder-audit.service';
import { HolderGuard } from './holder.guard';
import { HolderScopeService } from './holder-scope.service';

class AcceptTermsDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  version!: string;
}

/// PATCH /v1/holder/me — обновляет редактируемые поля профиля. Все поля
/// опциональны: фронт шлёт только то, что пользователь поменял.
class UpdateMyProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  phone?: string;

  /// Если false — пользователь хочет получать только транзакционные письма
  /// (magic-link, invite). Хранится в `User.metadata.notificationsEnabled`.
  @IsOptional()
  @IsBoolean()
  notificationsEnabled?: boolean;
}

/// Click-sign контракта правообладателем.
/// `consent=true` обязательно — это явное согласие пользователя
/// (галка в модалке UI). Версия пользовательского соглашения о подписании
/// записывается в `holderSignedTermsVer` и должна совпадать с версией,
/// которую показывали в UI.
class HolderSignContractDto {
  @IsBoolean()
  consent!: boolean;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  termsVersion!: string;
}

/// «Предложить тайтл» — правообладатель присылает заявку на добавление
/// нового тайтла в каталог. Менеджер получает её как Task.
class ProposeTitleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  @IsIn(['movie', 'series', 'tv_show', 'documentary', 'other'])
  kind?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  productionYear?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  countryOfOrigin?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  rightsAvailable?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  contactPhone?: string;
}

function authUser(req: Request): AuthUserView {
  return req.user as AuthUserView;
}

/// Экранирует пользовательский ввод для встраивания в HTML-абзацы письма.
/// Шаблоны emails допускают inline-html (<strong>, <em>) — но всё, что приходит
/// от пользователя (название тайтла, имя, телефон), надо чистить, иначе
/// он сможет вставить разметку или JS-обработчики.
function escapeForHtmlInline(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/// Multer-настройка для загрузок материалов из кабинета правообладателя.
/// Лимит 4 ГБ — самые тяжёлые слоты (master_video). Конкретный слот
/// проверяется в сервисе.
const MATERIAL_UPLOAD_LIMIT = 4 * 1024 * 1024 * 1024;

/// Кабинет правообладателя.
/// Все endpoints под /v1/holder/* — закрыты HolderGuard (роль rights_owner +
/// привязка к организации). Любая выборка идёт через HolderScopeService,
/// который автоматически фильтрует по organizationId.
@UseGuards(HolderGuard)
@Controller('holder')
export class HolderController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: HolderScopeService,
    private readonly audit: HolderAuditService,
    private readonly materials: MaterialRequestsService,
    private readonly contracts: ContractsService,
    private readonly email: EmailService,
  ) {}

  /// Вернуть профиль + флаг прохождения onboarding. Используется фронтом
  /// при загрузке любой страницы /holder/* — если acceptedTermsAt == null,
  /// клиент редиректит на /holder/onboarding.
  @Get('me')
  async me(@Req() req: Request) {
    const user = authUser(req);
    // Подтягиваем metadata напрямую из БД — auth-user.types.ts его не несёт,
    // но клиенту нужен phone и флаг notificationsEnabled для /holder/profile.
    // Телефон и флаги храним в `User.metadata` (jsonb), отдельных колонок нет.
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { metadata: true },
    });
    const meta = (dbUser?.metadata as
      | { phone?: string; notificationsEnabled?: boolean }
      | null
      | undefined) ?? null;
    return {
      user: {
        ...user,
        phone: meta?.phone ?? null,
        notificationsEnabled: meta?.notificationsEnabled !== false,
      },
      onboardingComplete: !!user.acceptedTermsAt,
    };
  }

  /// Редактирование профиля правообладателя из /holder/profile.
  /// Меняем только поля, которые пользователь явно прислал.
  @Patch('me')
  @HttpCode(HttpStatus.OK)
  async updateMe(@Body() dto: UpdateMyProfileDto, @Req() req: Request) {
    const user = authUser(req);

    // phone и notificationsEnabled живут в metadata (jsonb).
    // displayName — отдельная колонка User.displayName.
    const needsMetaUpdate =
      dto.phone !== undefined || dto.notificationsEnabled !== undefined;

    const data: Prisma.UserUpdateInput = {};
    if (dto.displayName !== undefined) {
      data.displayName = dto.displayName.trim() || null;
    }
    if (needsMetaUpdate) {
      const dbUser = await this.prisma.user.findUnique({
        where: { id: user.id },
        select: { metadata: true },
      });
      const oldMeta =
        (dbUser?.metadata as Record<string, unknown> | null) ?? {};
      const nextMeta: Record<string, unknown> = { ...oldMeta };
      if (dto.phone !== undefined) {
        const normalized = dto.phone.trim();
        if (normalized) nextMeta.phone = normalized;
        else delete nextMeta.phone;
      }
      if (dto.notificationsEnabled !== undefined) {
        nextMeta.notificationsEnabled = dto.notificationsEnabled;
      }
      data.metadata = nextMeta as Prisma.InputJsonValue;
    }

    const changedFields: string[] = [];
    if (dto.displayName !== undefined) changedFields.push('displayName');
    if (dto.phone !== undefined) changedFields.push('phone');
    if (dto.notificationsEnabled !== undefined)
      changedFields.push('notificationsEnabled');

    if (changedFields.length === 0) {
      return { ok: true, changed: false };
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data,
    });
    void this.audit.log({
      user,
      action: 'update_profile',
      entityType: 'User',
      entityId: user.id,
      metadata: { fields: changedFields },
      ...HolderAuditService.fromRequest(req),
    });
    return { ok: true, changed: true };
  }

  /// Повторное согласие с условиями для пользователей, попавших в кабинет
  /// без прохождения invite/accept (например, мигрированных вручную).
  @Post('me/accept-terms')
  @HttpCode(HttpStatus.OK)
  async acceptTerms(@Body() dto: AcceptTermsDto, @Req() req: Request) {
    const user = authUser(req);
    if (!user.organizationId) {
      throw new BadRequestException('Пользователь не привязан к организации');
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        acceptedTermsAt: new Date(),
        acceptedTermsVer: dto.version,
      },
    });
    await this.audit.log({
      user,
      action: 'invite_claimed',
      entityType: 'User',
      entityId: user.id,
      metadata: { version: dto.version, source: 'self_onboarding' },
      ...HolderAuditService.fromRequest(req),
    });
    return { ok: true };
  }

  @Get('dashboard')
  async dashboard(@Req() req: Request) {
    const user = authUser(req);
    const counters = await this.scope.dashboardCounters(user.organizationId!);
    void this.audit.log({
      user,
      action: 'view_dashboard',
      ...HolderAuditService.fromRequest(req),
    });
    return counters;
  }

  // -------------------------------------------------------------------------
  // CATALOG
  // -------------------------------------------------------------------------
  @Get('catalog-items')
  async catalogItems(@Req() req: Request) {
    const user = authUser(req);
    return this.scope.listCatalogItems(user.organizationId!);
  }

  @Get('catalog-items/:id')
  async catalogItem(@Param('id') id: string, @Req() req: Request) {
    const user = authUser(req);
    const item = await this.scope.findCatalogItemOrFail(user.organizationId!, id);
    void this.audit.log({
      user,
      action: 'view_catalog_item',
      entityType: 'CatalogItem',
      entityId: id,
      ...HolderAuditService.fromRequest(req),
    });
    return item;
  }

  // -------------------------------------------------------------------------
  // DEALS — без commercialSnapshot и без owner manager
  // -------------------------------------------------------------------------
  @Get('deals')
  async deals(@Req() req: Request) {
    const user = authUser(req);
    return this.scope.listDeals(user.organizationId!);
  }

  @Get('deals/:id')
  async deal(@Param('id') id: string, @Req() req: Request) {
    const user = authUser(req);
    const deal = await this.scope.findDealOrFail(user.organizationId!, id);
    void this.audit.log({
      user,
      action: 'view_deal',
      entityType: 'Deal',
      entityId: id,
      ...HolderAuditService.fromRequest(req),
    });
    return deal;
  }

  // -------------------------------------------------------------------------
  // PAYOUTS
  // -------------------------------------------------------------------------
  @Get('payouts')
  async payouts(@Req() req: Request) {
    const user = authUser(req);
    return this.scope.listPayouts(user.organizationId!);
  }

  // -------------------------------------------------------------------------
  // CONTRACTS
  // -------------------------------------------------------------------------
  @Get('contracts')
  async contracts_list(@Req() req: Request) {
    const user = authUser(req);
    return this.scope.listContracts(user.organizationId!);
  }

  /// Скачивание контракта правообладателем. Берём latest version, проверяем
  /// принадлежность организации, пишем в audit. Если версия указана явно —
  /// можем отдать её.
  @Get('contracts/:id/download')
  async downloadContract(
    @Param('id') id: string,
    @Req() req: Request,
    @Query('version') version?: string,
    @Query('inline') inline?: string,
  ) {
    const user = authUser(req);
    await this.scope.findContractOrFail(user.organizationId!, id);

    let v: number | null;
    if (version) {
      v = Number.parseInt(version, 10);
      if (!Number.isFinite(v) || v < 1) {
        throw new BadRequestException('Некорректный номер версии');
      }
    } else {
      v = await this.contracts.latestVersionNumber(id);
      if (v === null) {
        throw new NotFoundException('Версии контракта ещё нет');
      }
    }

    const { stream, fileName } = await this.contracts.getVersionFileForDownload(
      id,
      v,
    );
    void this.audit.log({
      user,
      action: 'download_contract',
      entityType: 'Contract',
      entityId: id,
      metadata: { version: v },
      ...HolderAuditService.fromRequest(req),
    });
    const ascii =
      fileName.replace(/[^\x20-\x7E]+/g, '_').replace(/"/g, '') ||
      `contract-v${v}.pdf`;
    const utf8 = encodeURIComponent(fileName);
    const asInline = inline === '1' || inline === 'true' || inline === 'yes';
    return new StreamableFile(stream, {
      type: 'application/pdf',
      disposition: asInline
        ? `inline; filename="${ascii}"; filename*=UTF-8''${utf8}`
        : `attachment; filename="${ascii}"; filename*=UTF-8''${utf8}`,
    });
  }

  /// Click-sign контракта правообладателем.
  /// Юридически значимое действие — фиксируем IP/UA/версию документа.
  /// После подписания статус контракта переводится в `signed`,
  /// а менеджер получает email-уведомление.
  @Post('contracts/:id/sign')
  @HttpCode(HttpStatus.OK)
  async signContract(
    @Param('id') id: string,
    @Body() dto: HolderSignContractDto,
    @Req() req: Request,
  ) {
    if (!dto.consent) {
      throw new BadRequestException('Требуется явное согласие на подпись');
    }
    const user = authUser(req);
    const orgId = user.organizationId!;

    const contract = await this.scope.findContractOrFail(orgId, id);
    if (contract.status !== 'sent') {
      throw new BadRequestException(
        'Подписать можно только контракт со статусом «отправлен»',
      );
    }

    const result = await this.contracts.signByHolder({
      contractId: id,
      userId: user.id,
      organizationId: orgId,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      termsVersion: dto.termsVersion,
    });

    void this.audit.log({
      user,
      action: 'sign_contract',
      entityType: 'Contract',
      entityId: id,
      metadata: {
        version: result.version,
        sha256: result.sha256,
        termsVersion: dto.termsVersion,
      },
      ...HolderAuditService.fromRequest(req),
    });

    // Уведомляем менеджеров (owner сделки и того, кто выпускал контракт),
    // best-effort — ошибки SMTP не блокируют подпись.
    void this.notifyManagersContractSigned(id, user, result.version).catch(() => undefined);

    return { ok: true, ...result };
  }

  /// Отправляет email менеджеру (Deal.owner) о том, что правообладатель
  /// подписал контракт. Метод private — не endpoint.
  private async notifyManagersContractSigned(
    contractId: string,
    holderUser: AuthUserView,
    version: number,
  ): Promise<void> {
    const c = await this.prisma.contract.findUnique({
      where: { id: contractId },
      select: {
        number: true,
        deal: {
          select: {
            id: true,
            title: true,
            owner: { select: { email: true, displayName: true } },
          },
        },
      },
    });
    if (!c?.deal?.owner?.email) return;

    const dealUrl = this.email.buildWebUrl(`/contracts/${contractId}`);
    await this.email.sendTemplated({
      to: c.deal.owner.email,
      category: 'contract-signed',
      subject: `Контракт ${c.number} подписан правообладателем`,
      entityId: contractId,
      respectUserPrefs: true,
      template: {
        title: `Контракт ${c.number} подписан`,
        preheader: 'Правообладатель завершил click-sign в кабинете',
        paragraphs: [
          `<strong>${escapeForHtmlInline(holderUser.displayName ?? holderUser.email)}</strong> подписал(а) контракт <strong>${escapeForHtmlInline(c.number)}</strong> в кабинете правообладателя.`,
        ],
        details: [
          { label: 'Сделка', value: c.deal.title },
          { label: 'Версия документа', value: `v${version}` },
        ],
        cta: { label: 'Открыть контракт', url: dealUrl },
      },
    });
  }

  // -------------------------------------------------------------------------
  // PROPOSE TITLE
  // -------------------------------------------------------------------------

  /// Правообладатель предлагает менеджеру добавить новый тайтл.
  /// Создаём Task, который менеджер увидит у себя в очереди.
  @Post('proposals')
  @HttpCode(HttpStatus.CREATED)
  async proposeTitle(@Body() dto: ProposeTitleDto, @Req() req: Request) {
    const user = authUser(req);
    const orgId = user.organizationId!;

    // Кому назначить задачу: ищем менеджера в той же организации (через invitedBy
    // последнего инвайта) или любого manager/admin как fallback.
    const assignee = await this.pickAssigneeForOrg(orgId);
    if (!assignee) {
      throw new BadRequestException(
        'Не найден менеджер для обработки заявки. Свяжитесь с поддержкой.',
      );
    }

    const orgInfo = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { legalName: true },
    });

    const lines = [
      `Предложение нового тайтла от правообладателя.`,
      `Организация: ${orgInfo?.legalName ?? orgId}`,
      `Контактное лицо: ${user.displayName ?? '—'} <${user.email}>`,
      dto.contactPhone ? `Телефон: ${dto.contactPhone}` : null,
      ``,
      `Название: ${dto.title}`,
      dto.kind ? `Тип: ${dto.kind}` : null,
      dto.productionYear ? `Год производства: ${dto.productionYear}` : null,
      dto.countryOfOrigin ? `Страна: ${dto.countryOfOrigin}` : null,
      ``,
      dto.rightsAvailable
        ? `Доступные права:\n${dto.rightsAvailable}`
        : null,
      ``,
      dto.description ? `Описание:\n${dto.description}` : null,
    ].filter(Boolean) as string[];

    // Дедлайн: +3 рабочих дня (упрощённо +5 календарных).
    const dueAt = new Date();
    dueAt.setDate(dueAt.getDate() + 5);

    const task = await this.prisma.task.create({
      data: {
        assigneeId: assignee.id,
        dueAt,
        type: 'custom',
        priority: 'medium',
        title: `Предложение тайтла: ${dto.title}`,
        description: lines.join('\n'),
        linkedEntityType: 'organization',
        linkedEntityId: orgId,
      },
    });

    void this.audit.log({
      user,
      action: 'propose_catalog_item',
      entityType: 'Task',
      entityId: task.id,
      metadata: {
        title: dto.title,
        kind: dto.kind,
        productionYear: dto.productionYear,
      },
      ...HolderAuditService.fromRequest(req),
    });

    if (assignee.email) {
      const tasksUrl = this.email.buildWebUrl(`/tasks`);
      void this.email.sendTemplated({
        to: assignee.email,
        category: 'title-proposed',
        subject: `Новое предложение тайтла: ${dto.title}`,
        entityId: task.id,
        respectUserPrefs: true,
        template: {
          title: 'Предложение нового тайтла',
          preheader: `${dto.title} — от ${orgInfo?.legalName ?? 'правообладателя'}`,
          paragraphs: [
            `<strong>${escapeForHtmlInline(user.displayName ?? user.email)}</strong> (${escapeForHtmlInline(orgInfo?.legalName ?? '—')}) предлагает добавить новый тайтл в каталог.`,
            dto.description
              ? escapeForHtmlInline(dto.description)
              : 'Описание не указано.',
            dto.rightsAvailable
              ? `<em>Доступные права:</em> ${escapeForHtmlInline(dto.rightsAvailable)}`
              : '',
          ].filter(Boolean),
          details: [
            { label: 'Название', value: dto.title },
            ...(dto.kind ? [{ label: 'Тип', value: dto.kind }] : []),
            ...(dto.productionYear
              ? [{ label: 'Год производства', value: dto.productionYear }]
              : []),
            ...(dto.countryOfOrigin
              ? [{ label: 'Страна', value: dto.countryOfOrigin }]
              : []),
            ...(dto.contactPhone
              ? [{ label: 'Телефон', value: dto.contactPhone }]
              : []),
            { label: 'Email', value: user.email },
          ],
          cta: { label: 'Открыть задачу', url: tasksUrl },
          ctaNote: 'Заявка ожидает реакции в течение 5 рабочих дней.',
        },
      });
    }

    return { ok: true, taskId: task.id };
  }

  /// Подбираем менеджера для назначения задачи от правообладателя.
  /// 1. Тот, кто последний раз приглашал кого-то в эту организацию
  ///    (`HolderInvite.invitedByUserId`).
  /// 2. Любой active manager/admin как fallback.
  private async pickAssigneeForOrg(orgId: string) {
    const lastInvite = await this.prisma.holderInvite.findFirst({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
      select: {
        invitedBy: { select: { id: true, email: true, role: true } },
      },
    });
    if (lastInvite?.invitedBy) {
      return lastInvite.invitedBy;
    }
    return this.prisma.user.findFirst({
      where: { role: { in: ['admin', 'manager'] } },
      orderBy: { createdAt: 'asc' },
      select: { id: true, email: true, role: true },
    });
  }

  // -------------------------------------------------------------------------
  // MATERIAL REQUESTS
  // -------------------------------------------------------------------------

  /// Каталог слотов — отдаём фронту, чтобы он мог отрисовать чек-лист.
  @Get('material-slots')
  materialSlots() {
    return MATERIAL_SLOTS;
  }

  @Get('material-requests')
  async materialRequests(
    @Req() req: Request,
    @Query('activeOnly') activeOnly?: string,
  ) {
    const user = authUser(req);
    const onlyActive =
      activeOnly === '1' || activeOnly === 'true' || activeOnly === 'yes';
    return this.materials.listForHolder(user.organizationId!, {
      activeOnly: onlyActive,
    });
  }

  @Get('material-requests/:id')
  async materialRequestOne(@Param('id') id: string, @Req() req: Request) {
    const user = authUser(req);
    return this.materials.findForHolderOrFail(user.organizationId!, id);
  }

  @Post('material-requests/:id/uploads')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: materialDiskStorage(),
      limits: { fileSize: MATERIAL_UPLOAD_LIMIT },
    }),
  )
  async uploadMaterial(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('slot') slot: string,
    @Req() req: Request,
  ) {
    if (!file) {
      throw new BadRequestException('Передайте файл поля "file"');
    }
    if (!slot || typeof slot !== 'string') {
      throw new BadRequestException('Передайте slot');
    }
    const user = authUser(req);
    const upload = await this.materials.addUpload(
      user.organizationId!,
      id,
      slot,
      file,
    );
    void this.audit.log({
      user,
      action: 'upload_material',
      entityType: 'MaterialUpload',
      entityId: upload.id,
      metadata: {
        requestId: id,
        slot,
        size: Number(upload.size),
        originalName: upload.originalName,
      },
      ...HolderAuditService.fromRequest(req),
    });
    return {
      id: upload.id,
      slot: upload.slot,
      originalName: upload.originalName,
      size: upload.size.toString(),
      reviewStatus: upload.reviewStatus,
      uploadedAt: upload.uploadedAt,
    };
  }

  @Delete('material-requests/:id/uploads/:uploadId')
  async deleteMaterialUpload(
    @Param('id') id: string,
    @Param('uploadId') uploadId: string,
    @Req() req: Request,
  ) {
    const user = authUser(req);
    const result = await this.materials.deleteUploadByHolder(
      user.organizationId!,
      id,
      uploadId,
    );
    void this.audit.log({
      user,
      action: 'upload_material',
      entityType: 'MaterialUpload',
      entityId: uploadId,
      metadata: { action: 'delete', requestId: id },
      ...HolderAuditService.fromRequest(req),
    });
    return result;
  }

  /// Скачивание ранее загруженного файла самим правообладателем
  /// (проверка через requestId + orgId).
  @Get('material-requests/:id/uploads/:uploadId/download')
  async downloadMaterial(
    @Param('id') id: string,
    @Param('uploadId') uploadId: string,
    @Req() req: Request,
    @Query('inline') inline?: string,
  ) {
    const user = authUser(req);
    const meta = await this.materials.getUploadFileMeta(id, uploadId);
    if (meta.organizationId !== user.organizationId) {
      throw new NotFoundException('Загрузка не найдена');
    }
    if (!existsSync(meta.absPath)) {
      throw new NotFoundException('Файл недоступен');
    }
    const ascii =
      meta.originalName.replace(/[^\x20-\x7E]+/g, '_').replace(/"/g, '') ||
      'file';
    const utf8 = encodeURIComponent(meta.originalName);
    const asInline = inline === '1' || inline === 'true' || inline === 'yes';
    return new StreamableFile(createReadStream(meta.absPath), {
      type: meta.mimeType,
      disposition: asInline
        ? `inline; filename="${ascii}"; filename*=UTF-8''${utf8}`
        : `attachment; filename="${ascii}"; filename*=UTF-8''${utf8}`,
    });
  }
}
