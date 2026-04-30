import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createReadStream, existsSync } from 'fs';
import type { Readable } from 'stream';
import {
  MaterialRequestStatus,
  MaterialReviewStatus,
  Prisma,
  UserRole,
} from '@prisma/client';
import type { AuthUserView } from '../auth/auth-user.types';
import { EmailService } from '../email/email.service';
import { HetznerStorageService } from '../hetzner-storage/hetzner-storage.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateMaterialRequestDto,
  ReviewUploadDto,
  UpdateMaterialRequestDto,
} from './dto';
import {
  detectFileSignature,
  isExtensionAllowedForSlot,
  isMimeAllowedForSlot,
  isValidSlot,
  maxSizeForSlot,
  MATERIAL_SLOTS,
} from './material-slots';
import { open } from 'fs/promises';
import {
  materialAbsolutePath,
  materialRemotePath,
  safeUnlinkMaterial,
} from './material-storage';

const REQUEST_INCLUDE = {
  uploads: {
    orderBy: { uploadedAt: 'desc' as const },
    include: {
      reviewedBy: {
        select: {
          id: true,
          displayName: true,
          email: true,
        },
      },
    },
  },
  catalogItem: {
    select: {
      id: true,
      title: true,
      slug: true,
      assetType: true,
      rightsHolderOrgId: true,
    },
  },
  organization: {
    select: { id: true, legalName: true, type: true },
  },
} satisfies Prisma.MaterialRequestInclude;

export type MaterialRequestWithUploads = Prisma.MaterialRequestGetPayload<{
  include: typeof REQUEST_INCLUDE;
}>;

@Injectable()
export class MaterialRequestsService {
  private readonly logger = new Logger(MaterialRequestsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly hetzner: HetznerStorageService,
  ) {}

  // ==========================================================================
  // CRM-side
  // ==========================================================================

  /// Менеджер создаёт запрос материалов на тайтл. orgId берём из тайтла.
  async createForCatalogItem(
    dto: CreateMaterialRequestDto,
    creatorUserId: string,
  ): Promise<MaterialRequestWithUploads> {
    const item = await this.prisma.catalogItem.findUnique({
      where: { id: dto.catalogItemId },
      select: { id: true, rightsHolderOrgId: true, title: true },
    });
    if (!item) throw new NotFoundException('Тайтл не найден');
    if (!item.rightsHolderOrgId) {
      throw new BadRequestException(
        'У тайтла не указан правообладатель, материалы запросить нельзя',
      );
    }
    for (const slot of dto.requestedSlots) {
      if (!isValidSlot(slot)) {
        throw new BadRequestException(`Неизвестный slot: ${slot}`);
      }
    }
    const created = await this.prisma.materialRequest.create({
      data: {
        catalogItemId: item.id,
        organizationId: item.rightsHolderOrgId,
        requestedSlots: dto.requestedSlots,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
        note: dto.note ?? null,
        createdByUserId: creatorUserId,
        status: MaterialRequestStatus.pending,
      },
      include: REQUEST_INCLUDE,
    });

    // Уведомляем активных правообладателей организации.
    void this.notifyHoldersRequestCreated(created).catch((e) =>
      this.logger.error(
        `notifyHoldersRequestCreated failed: ${e instanceof Error ? e.message : String(e)}`,
      ),
    );

    return created;
  }

  async listForCatalogItem(catalogItemId: string) {
    return this.prisma.materialRequest.findMany({
      where: { catalogItemId },
      orderBy: { createdAt: 'desc' },
      include: REQUEST_INCLUDE,
    });
  }

  async listAllForManager(filter: { status?: MaterialRequestStatus }) {
    return this.prisma.materialRequest.findMany({
      where: filter.status ? { status: filter.status } : {},
      orderBy: { createdAt: 'desc' },
      include: REQUEST_INCLUDE,
    });
  }

  async findByIdForManager(id: string) {
    const req = await this.prisma.materialRequest.findUnique({
      where: { id },
      include: REQUEST_INCLUDE,
    });
    if (!req) throw new NotFoundException('Запрос не найден');
    return req;
  }

  async update(id: string, dto: UpdateMaterialRequestDto) {
    const req = await this.findByIdForManager(id);
    const data: Prisma.MaterialRequestUpdateInput = {};
    if (dto.requestedSlots !== undefined) {
      for (const slot of dto.requestedSlots) {
        if (!isValidSlot(slot)) {
          throw new BadRequestException(`Неизвестный slot: ${slot}`);
        }
      }
      data.requestedSlots = { set: dto.requestedSlots };
    }
    if (dto.dueAt !== undefined) {
      data.dueAt = dto.dueAt ? new Date(dto.dueAt) : null;
    }
    if (dto.note !== undefined) {
      data.note = dto.note || null;
    }
    await this.prisma.materialRequest.update({ where: { id: req.id }, data });
    await this.recomputeStatus(req.id);
    return this.findByIdForManager(req.id);
  }

  /// Удалить запрос — только если ни один upload не одобрен.
  async cancel(id: string): Promise<{ ok: true }> {
    const req = await this.findByIdForManager(id);
    const hasApproved = req.uploads.some(
      (u) => u.reviewStatus === MaterialReviewStatus.approved,
    );
    if (hasApproved) {
      throw new BadRequestException(
        'Нельзя удалить запрос, в котором уже есть одобренные материалы',
      );
    }
    await this.prisma.materialRequest.update({
      where: { id },
      data: { status: MaterialRequestStatus.cancelled },
    });
    return { ok: true };
  }

  /// Менеджер ревьюит загрузку: approve/reject/pending + комментарий.
  async reviewUpload(
    requestId: string,
    uploadId: string,
    reviewer: AuthUserView,
    dto: ReviewUploadDto,
  ) {
    const upload = await this.prisma.materialUpload.findUnique({
      where: { id: uploadId },
      select: { id: true, requestId: true, originalName: true, slot: true },
    });
    if (!upload || upload.requestId !== requestId) {
      throw new NotFoundException('Загрузка не найдена');
    }
    await this.prisma.materialUpload.update({
      where: { id: uploadId },
      data: {
        reviewStatus: dto.reviewStatus,
        reviewerComment: dto.reviewerComment ?? null,
        reviewedByUserId: reviewer.id,
        reviewedAt: new Date(),
      },
    });
    await this.recomputeStatus(requestId);

    void this.notifyHoldersUploadReviewed({
      requestId,
      slot: upload.slot,
      originalName: upload.originalName,
      reviewStatus: dto.reviewStatus,
      reviewerComment: dto.reviewerComment ?? null,
      reviewer,
    }).catch((e) =>
      this.logger.error(
        `notifyHoldersUploadReviewed failed: ${e instanceof Error ? e.message : String(e)}`,
      ),
    );

    return this.findByIdForManager(requestId);
  }

  // ==========================================================================
  // Holder-side
  // ==========================================================================

  async listForHolder(orgId: string, filter: { activeOnly?: boolean } = {}) {
    return this.prisma.materialRequest.findMany({
      where: {
        organizationId: orgId,
        ...(filter.activeOnly
          ? {
              status: {
                in: [
                  MaterialRequestStatus.pending,
                  MaterialRequestStatus.partial,
                ],
              },
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: REQUEST_INCLUDE,
    });
  }

  async findForHolderOrFail(orgId: string, id: string) {
    const req = await this.prisma.materialRequest.findFirst({
      where: { id, organizationId: orgId },
      include: REQUEST_INCLUDE,
    });
    if (!req) throw new NotFoundException('Запрос не найден');
    return req;
  }

  async addUpload(
    orgId: string,
    requestId: string,
    slot: string,
    file: Express.Multer.File,
  ) {
    const localPathForCleanup = materialAbsolutePath(requestId, file.filename);
    const reject = async (msg: string): Promise<never> => {
      await safeUnlinkMaterial(localPathForCleanup);
      throw new BadRequestException(msg);
    };

    if (!isValidSlot(slot)) {
      return reject(`Неизвестный slot: ${slot}`);
    }
    const max = maxSizeForSlot(slot);
    if (file.size > max) {
      return reject(`Файл слишком большой для слота ${slot}: лимит ${max} байт`);
    }
    if (!isMimeAllowedForSlot(slot, file.mimetype)) {
      return reject(`MIME ${file.mimetype} не подходит для слота ${slot}`);
    }
    // Whitelist по расширению (multer кладёт оригинальное имя в `originalname`).
    if (!isExtensionAllowedForSlot(slot, file.originalname)) {
      return reject(
        `Расширение файла не разрешено для слота ${slot}. Допустимые форматы перечислены в описании слота.`,
      );
    }
    // Минимальная проверка по магическим байтам — отсекаем грубую подмену
    // расширения (например, .exe, переименованный в .mp4). Не панацея —
    // настоящая антивирусная проверка должна делаться отдельным воркером.
    try {
      const fh = await open(localPathForCleanup, 'r');
      try {
        const buf = Buffer.alloc(32);
        await fh.read(buf, 0, 32, 0);
        const detected = detectFileSignature(buf);
        // Если сигнатура распознана и явно не подходит для слота — отказываем.
        // Если не распознана (документы, субтитры, exotic-видео) — пропускаем.
        if (detected) {
          if (!isMimeAllowedForSlot(slot, detected)) {
            return reject(
              `Содержимое файла не соответствует слоту: обнаружен тип ${detected}.`,
            );
          }
        }
      } finally {
        await fh.close();
      }
    } catch (e) {
      this.logger.warn(
        `signature check failed for ${file.filename}: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
    }
    const req = await this.findForHolderOrFail(orgId, requestId);
    if (
      req.status === MaterialRequestStatus.cancelled ||
      req.status === MaterialRequestStatus.rejected
    ) {
      await safeUnlinkMaterial(materialAbsolutePath(requestId, file.filename));
      throw new BadRequestException('Запрос закрыт, загрузка невозможна');
    }
    if (!req.requestedSlots.includes(slot)) {
      await safeUnlinkMaterial(materialAbsolutePath(requestId, file.filename));
      throw new BadRequestException(
        `Слот ${slot} не запрашивался в этом запросе`,
      );
    }
    const localPath = materialAbsolutePath(requestId, file.filename);
    const remotePath = materialRemotePath(requestId, file.filename);
    try {
      await this.hetzner.upload(remotePath, createReadStream(localPath));
    } catch (e) {
      this.logger.error(
        `material upload to storage box failed: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
      throw new BadRequestException(
        'Не удалось сохранить файл в Storage Box. Повторите загрузку.',
      );
    } finally {
      await safeUnlinkMaterial(localPath);
    }
    const upload = await this.prisma.materialUpload.create({
      data: {
        requestId,
        slot,
        storedFileName: file.filename,
        originalName: file.originalname.slice(0, 500),
        size: BigInt(file.size),
        mimeType: file.mimetype || null,
      },
    });
    await this.recomputeStatus(requestId);
    return upload;
  }

  /// Удалить ОЖИДАЮЩУЮ ревью загрузку. Уже одобренные/отклонённые удалить нельзя
  /// (нужен audit trail).
  async deleteUploadByHolder(
    orgId: string,
    requestId: string,
    uploadId: string,
  ) {
    const upload = await this.prisma.materialUpload.findUnique({
      where: { id: uploadId },
      include: { request: { select: { organizationId: true, id: true } } },
    });
    if (!upload || upload.request.id !== requestId) {
      throw new NotFoundException('Загрузка не найдена');
    }
    if (upload.request.organizationId !== orgId) {
      throw new ForbiddenException('Чужая загрузка');
    }
    if (upload.reviewStatus !== MaterialReviewStatus.pending) {
      throw new BadRequestException(
        'Можно удалить только загрузки в статусе «на проверке»',
      );
    }
    await this.prisma.materialUpload.delete({ where: { id: uploadId } });
    await safeUnlinkMaterial(materialAbsolutePath(requestId, upload.storedFileName));
    await this.hetzner
      .delete(materialRemotePath(requestId, upload.storedFileName))
      .catch(() => null);
    await this.recomputeStatus(requestId);
    return { ok: true };
  }

  /// Стрим файла загрузки. Возвращает абсолютный путь — контроллер сам обернёт
  /// в StreamableFile. Доступ должен проверяться на уровне контроллера
  /// (manager — без скоупа, holder — с проверкой orgId).
  async getUploadFileMeta(requestId: string, uploadId: string) {
    const upload = await this.prisma.materialUpload.findUnique({
      where: { id: uploadId },
      include: { request: { select: { id: true, organizationId: true } } },
    });
    if (!upload || upload.request.id !== requestId) {
      throw new NotFoundException('Загрузка не найдена');
    }
    return {
      absPath: materialAbsolutePath(requestId, upload.storedFileName),
      remotePath: materialRemotePath(requestId, upload.storedFileName),
      originalName: upload.originalName,
      mimeType: upload.mimeType ?? 'application/octet-stream',
      organizationId: upload.request.organizationId,
    };
  }

  async getUploadFileForDownload(requestId: string, uploadId: string): Promise<{
    stream: Readable;
    originalName: string;
    mimeType: string;
    organizationId: string;
  }> {
    const meta = await this.getUploadFileMeta(requestId, uploadId);
    const remoteExists = await this.hetzner.exists(meta.remotePath).catch(() => false);
    if (remoteExists) {
      const stream = await this.hetzner.downloadStream(meta.remotePath);
      return {
        stream,
        originalName: meta.originalName,
        mimeType: meta.mimeType,
        organizationId: meta.organizationId,
      };
    }
    if (!existsSync(meta.absPath)) {
      throw new NotFoundException('Файл недоступен');
    }
    return {
      stream: createReadStream(meta.absPath),
      originalName: meta.originalName,
      mimeType: meta.mimeType,
      organizationId: meta.organizationId,
    };
  }

  // ==========================================================================
  // Common helpers
  // ==========================================================================

  /// Пересчитываем статус запроса, исходя из загрузок и их review-статусов.
  /// Не трогаем `cancelled`/`rejected` — они выставляются вручную.
  private async recomputeStatus(requestId: string): Promise<void> {
    const req = await this.prisma.materialRequest.findUnique({
      where: { id: requestId },
      include: {
        uploads: {
          select: { slot: true, reviewStatus: true },
        },
      },
    });
    if (!req) return;
    if (
      req.status === MaterialRequestStatus.cancelled ||
      req.status === MaterialRequestStatus.rejected
    ) {
      return;
    }

    const requestedSlots = new Set(req.requestedSlots);
    const approvedSlots = new Set<string>();
    let anyUpload = false;
    for (const u of req.uploads) {
      anyUpload = true;
      if (u.reviewStatus === MaterialReviewStatus.approved) {
        approvedSlots.add(u.slot);
      }
    }

    let next: MaterialRequestStatus = MaterialRequestStatus.pending;
    if (anyUpload) next = MaterialRequestStatus.partial;
    if (
      requestedSlots.size > 0 &&
      [...requestedSlots].every((s) => approvedSlots.has(s))
    ) {
      next = MaterialRequestStatus.complete;
    }

    if (next !== req.status) {
      await this.prisma.materialRequest.update({
        where: { id: requestId },
        data: { status: next },
      });
      if (next === MaterialRequestStatus.complete) {
        void this.notifyManagerRequestComplete(requestId).catch((e) =>
          this.logger.error(
            `notifyManagerRequestComplete failed: ${e instanceof Error ? e.message : String(e)}`,
          ),
        );
      }
    }
  }

  // ==========================================================================
  // Email-уведомления
  // ==========================================================================

  /// Список email активных пользователей-правообладателей организации.
  private async getHolderEmailsForOrg(orgId: string): Promise<string[]> {
    const users = await this.prisma.user.findMany({
      where: {
        organizationId: orgId,
        role: UserRole.rights_owner,
      },
      select: { email: true },
    });
    return users.map((u) => u.email);
  }

  private async notifyHoldersRequestCreated(
    req: MaterialRequestWithUploads,
  ): Promise<void> {
    const recipients = await this.getHolderEmailsForOrg(req.organizationId);
    if (recipients.length === 0) return;

    // Подтягиваем менеджера-инициатора для From/Reply-To. Имя не подставляем,
    // показываем только email — так получатель сразу видит личный адрес для
    // ответа.
    const creator = await this.prisma.user.findUnique({
      where: { id: req.createdByUserId },
      select: { email: true },
    });
    const senderLabel = creator?.email ?? 'Менеджер';
    const senderReplyTo = creator?.email;

    const url = this.email.buildWebUrl(`/holder/materials/${req.id}`);
    const slotLabels = req.requestedSlots
      .map((key) => MATERIAL_SLOTS.find((s) => s.key === key)?.label ?? key)
      .join(', ');

    for (const to of recipients) {
      void this.email.sendTemplated({
        to,
        category: 'material-request-created',
        subject: `Запрос материалов: ${req.catalogItem.title}`,
        entityId: req.id,
        respectUserPrefs: true,
        fromName: senderLabel,
        fromAddress: senderReplyTo,
        replyTo: senderReplyTo,
        template: {
          title: 'Менеджер запросил материалы',
          preheader: `Тайтл: ${req.catalogItem.title}`,
          paragraphs: [
            `<strong>${escapeHtml(senderLabel)}</strong> создал(а) запрос материалов по тайтлу <strong>${escapeHtml(req.catalogItem.title)}</strong>.`,
            req.note
              ? `Комментарий менеджера: <em>${escapeHtml(req.note)}</em>`
              : 'Загрузить материалы можно из кабинета — в карточке запроса по ссылке ниже.',
          ],
          details: [
            { label: 'Запрошенные слоты', value: slotLabels || '—' },
            ...(req.dueAt
              ? [
                  {
                    label: 'Срок',
                    value: new Date(req.dueAt).toLocaleDateString('ru-RU'),
                  },
                ]
              : []),
          ],
          cta: { label: 'Открыть запрос', url },
          ctaNote: senderReplyTo
            ? 'Чтобы задать вопрос менеджеру — просто ответьте на это письмо.'
            : undefined,
        },
      });
    }
  }

  private async notifyHoldersUploadReviewed(input: {
    requestId: string;
    slot: string;
    originalName: string;
    reviewStatus: MaterialReviewStatus;
    reviewerComment: string | null;
    reviewer: AuthUserView;
  }): Promise<void> {
    const req = await this.prisma.materialRequest.findUnique({
      where: { id: input.requestId },
      select: {
        id: true,
        organizationId: true,
        catalogItem: { select: { title: true } },
      },
    });
    if (!req) return;
    const recipients = await this.getHolderEmailsForOrg(req.organizationId);
    if (recipients.length === 0) return;

    const slotLabel =
      MATERIAL_SLOTS.find((s) => s.key === input.slot)?.label ?? input.slot;
    const isApproved = input.reviewStatus === MaterialReviewStatus.approved;
    const url = this.email.buildWebUrl(`/holder/materials/${req.id}`);

    const subject = isApproved
      ? `Материал принят: ${input.originalName}`
      : `Материал отклонён: ${input.originalName}`;
    const reviewerEmail = input.reviewer.email ?? 'Менеджер';

    for (const to of recipients) {
      void this.email.sendTemplated({
        to,
        category: 'material-upload-reviewed',
        subject,
        entityId: req.id,
        respectUserPrefs: true,
        fromName: reviewerEmail,
        fromAddress: input.reviewer.email,
        replyTo: input.reviewer.email,
        template: {
          title: isApproved ? 'Материал принят' : 'Материал отклонён',
          preheader: `${slotLabel} • ${req.catalogItem.title}`,
          paragraphs: [
            isApproved
              ? `Менеджер принял ваш файл по слоту <strong>${escapeHtml(slotLabel)}</strong> для тайтла <strong>${escapeHtml(req.catalogItem.title)}</strong>.`
              : `Менеджер отклонил ваш файл по слоту <strong>${escapeHtml(slotLabel)}</strong> для тайтла <strong>${escapeHtml(req.catalogItem.title)}</strong>. Загрузите, пожалуйста, новую версию.`,
            input.reviewerComment
              ? `Комментарий менеджера: <em>${escapeHtml(input.reviewerComment)}</em>`
              : '',
          ].filter(Boolean),
          details: [
            { label: 'Файл', value: input.originalName },
            { label: 'Слот', value: slotLabel },
          ],
          cta: { label: 'Открыть запрос', url },
        },
      });
    }
  }

  private async notifyManagerRequestComplete(
    requestId: string,
  ): Promise<void> {
    const req = await this.prisma.materialRequest.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        catalogItem: { select: { id: true, title: true } },
        organization: { select: { legalName: true } },
        createdByUserId: true,
      },
    });
    if (!req) return;
    const manager = await this.prisma.user.findUnique({
      where: { id: req.createdByUserId },
      select: { email: true, displayName: true },
    });
    if (!manager?.email) return;

    const url = this.email.buildWebUrl(`/content?focus=${req.catalogItem.id}`);
    void this.email.sendTemplated({
      to: manager.email,
      category: 'material-request-complete',
      subject: `Запрос материалов закрыт: ${req.catalogItem.title}`,
      entityId: requestId,
      respectUserPrefs: true,
      template: {
        title: 'Все запрошенные материалы получены',
        preheader: `${req.catalogItem.title} — ${req.organization.legalName}`,
        paragraphs: [
          `Правообладатель <strong>${escapeHtml(req.organization.legalName)}</strong> загрузил все материалы по тайтлу <strong>${escapeHtml(req.catalogItem.title)}</strong>, и все они приняты.`,
          'Можно переходить к следующим этапам сделки.',
        ],
        cta: { label: 'Открыть тайтл', url },
      },
    });
  }

  /// Каталог слотов отдаём в API: фронту нужен label/description/maxSize.
  static readonly slotCatalog = MATERIAL_SLOTS;
}

/// Inline-escape пользовательского ввода для HTML-абзацев писем.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
