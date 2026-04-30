import {
  BadRequestException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { createReadStream, existsSync } from 'fs';
import { copyFile, mkdir, readFile, rm, unlink } from 'fs/promises';
import * as path from 'path';
import {
  DealActivityKind,
  DealKind,
  DealStage,
  Exclusivity,
  Platform,
  Prisma,
} from '@prisma/client';
import { HetznerStorageService } from '../hetzner-storage/hetzner-storage.service';
import { PrismaService } from '../prisma/prisma.service';
import { DriveService } from '../drive/drive.service';
import { CreateDealDto } from './dto/create-deal.dto';
import { DealActivityDto } from './dto/deal-activity.dto';
import { UpdateDealDto } from './dto/update-deal.dto';
import { ValidateRightsDto } from './dto/rights-selection-item.dto';
import type {
  DealDocumentSlot,
  DealDocumentStored,
} from './deal-document-slots';
import {
  CLOSED_DEAL_STAGES,
  isBlockingRightsConflict,
  parseRightsSelection,
  territoryCoveredByLicenseTerm,
  territoriesOverlap,
} from './rights-validation';
import { createHash } from 'crypto';
import { Decimal } from '@prisma/client/runtime/library';

function normalizeUploadedFileName(name: string): string {
  const raw = (name || '').trim();
  if (!raw) return 'document';
  // Multer may decode UTF-8 bytes as latin1 for multipart filenames.
  const looksMojibake = /[ÐÑÃÂ]/.test(raw) && !/[А-Яа-яЁё]/.test(raw);
  if (!looksMojibake) return raw;
  try {
    const fixed = Buffer.from(raw, 'latin1').toString('utf8').trim();
    return fixed || raw;
  } catch {
    return raw;
  }
}

@Injectable()
export class DealsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly drive: DriveService,
    private readonly hetzner: HetznerStorageService,
  ) {}

  private async syncUploadedPdfToLatestContractVersion(
    dealId: string,
    file: Express.Multer.File,
  ) {
    const ext = (path.extname(file.originalname) || '').toLowerCase();
    if (ext !== '.pdf') return;

    const contract = await this.prisma.contract.findFirst({
      where: { dealId, archived: false, clientCabinetSigned: false },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, templateId: true },
    });
    if (!contract) return;

    const last = await this.prisma.contractVersion.findFirst({
      where: { contractId: contract.id },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const nextVersion = (last?.version ?? 0) + 1;
    const storageKey = `contracts/${contract.id}/v${nextVersion}.pdf`;
    const root = process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'uploads');
    const absDst = path.join(root, storageKey);
    const absSrc = file.path;

    await mkdir(path.dirname(absDst), { recursive: true });
    await copyFile(absSrc, absDst);
    const fileBuffer = await readFile(absDst);
    const sha256 = createHash('sha256').update(fileBuffer).digest('hex');

    await this.prisma.contractVersion.create({
      data: {
        contractId: contract.id,
        version: nextVersion,
        storageKey,
        sha256,
        templateId: contract.templateId ?? 'default-template',
      },
    });

    // Зеркалим в Hetzner Storage Box (best-effort): persistent disk Render
    // не реплицируется, и потеря инстанса = потеря всех договоров. См.
    // ContractsService.tryRestoreFromHetzner для fallback при чтении.
    try {
      const remoteRoot = (
        process.env.HETZNER_CONTRACTS_DIR ?? '/contentflow/contracts'
      ).replace(/\/+$/, '');
      await this.hetzner.upload(`${remoteRoot}/${storageKey}`, fileBuffer);
    } catch {
      // тихо проглатываем: бизнес-операция не должна валиться от внешнего хранилища
    }
  }

  findAll(filters?: {
    stage?: string;
    q?: string;
    ownerUserId?: string;
    buyerOrgId?: string;
    currency?: string;
    catalogItemId?: string;
    kind?: string;
    /** `true` — только архив; иначе только активные (не в архиве). */
    archived?: boolean;
    /** Ограничение выборки (1–200), без параметра — все подходящие. */
    take?: number;
  }) {
    const where: Prisma.DealWhereInput = {};
    where.archived = filters?.archived === true;
    if (
      filters?.stage &&
      Object.values(DealStage).includes(filters.stage as DealStage)
    ) {
      where.stage = filters.stage as DealStage;
    }
    if (
      filters?.kind &&
      Object.values(DealKind).includes(filters.kind as DealKind)
    ) {
      where.kind = filters.kind as DealKind;
    }
    if (filters?.ownerUserId) {
      where.ownerUserId = filters.ownerUserId;
    }
    if (filters?.buyerOrgId) {
      where.buyerOrgId = filters.buyerOrgId;
    }
    if (filters?.currency?.trim()) {
      where.currency = filters.currency.trim().toUpperCase().slice(0, 3);
    }
    if (filters?.catalogItemId?.trim()) {
      where.catalogItems = {
        some: { catalogItemId: filters.catalogItemId.trim() },
      };
    }
    if (filters?.q?.trim()) {
      const q = filters.q.trim();
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { buyer: { legalName: { contains: q, mode: 'insensitive' } } },
      ];
    }
    const take =
      filters?.take != null
        ? Math.min(200, Math.max(1, Math.floor(filters.take)))
        : undefined;
    return this.prisma.deal.findMany({
      where,
      ...(take != null ? { take } : {}),
      orderBy: { updatedAt: 'desc' },
      include: {
        buyer: true,
        owner: true,
        catalogItems: { include: { catalogItem: true } },
      },
    });
  }

  async duplicate(sourceId: string) {
    const src = await this.prisma.deal.findUnique({
      where: { id: sourceId },
      include: { catalogItems: true },
    });
    if (!src) throw new NotFoundException();

    const snap = src.commercialSnapshot as Record<string, unknown> | null;
    const ev = snap?.expectedValue;
    const commercialExpectedValue =
      typeof ev === 'string' || typeof ev === 'number' ? String(ev) : undefined;

    const rightsSelections = src.catalogItems.map((row) => {
      const p = parseRightsSelection(row.rightsSelection);
      if (p) {
        return {
          catalogItemId: row.catalogItemId,
          territoryCodes: p.territoryCodes,
          startAt: p.startAt ? p.startAt.toISOString().slice(0, 10) : undefined,
          endAt: p.endAt ? p.endAt.toISOString().slice(0, 10) : undefined,
          platforms: p.platforms,
          exclusivity: p.exclusivity,
        };
      }
      return {
        catalogItemId: row.catalogItemId,
        territoryCodes: ['KZ'],
        platforms: [Platform.TV],
        exclusivity: Exclusivity.non_exclusive,
      };
    });

    return this.create({
      title: `${src.title} (копия)`,
      kind: src.kind,
      buyerOrgId: src.buyerOrgId,
      ownerUserId: src.ownerUserId,
      currency: src.currency,
      catalogItemIds: src.catalogItems.map((c) => c.catalogItemId),
      commercialExpectedValue,
      rightsSelections: rightsSelections.length ? rightsSelections : undefined,
    });
  }

  findOne(id: string) {
    return this.prisma.deal.findUnique({
      where: { id },
      include: {
        buyer: true,
        owner: true,
        catalogItems: {
          include: { catalogItem: { include: { licenseTerms: true } } },
        },
        activities: {
          orderBy: { createdAt: 'desc' },
          include: { user: { select: { id: true, email: true } } },
        },
        contracts: {
          orderBy: { createdAt: 'desc' },
          include: {
            versions: {
              orderBy: { version: 'desc' },
              take: 1,
              select: { version: true },
            },
          },
        },
        payments: { orderBy: { createdAt: 'desc' } },
      },
    });
  }

  dealFingerprint(deal: {
    title: string;
    buyerOrgId: string;
    currency: string;
    catalogItems: {
      catalogItemId: string;
      rightsSelection: Prisma.JsonValue | null;
    }[];
  }): string {
    const payload = JSON.stringify({
      title: deal.title,
      buyerOrgId: deal.buyerOrgId,
      currency: deal.currency,
      lines: deal.catalogItems.map((l) => ({
        id: l.catalogItemId,
        r: l.rightsSelection,
      })),
    });
    return createHash('sha256').update(payload).digest('hex').slice(0, 32);
  }

  async create(data: CreateDealDto) {
    const {
      catalogItemIds = [],
      rightsSelections = [],
      commercialExpectedValue,
      vatIncluded = true,
      adminOverride,
      signedAt,
      effectiveAt,
      paymentModel,
      paymentTerms,
      deliveryDeadline,
      notes,
      minimumGuarantee,
      ...dealData
    } = data;

    for (const rs of rightsSelections ?? []) {
      const check = await this.validateRights({
        catalogItemId: rs.catalogItemId,
        selection: rs,
        adminOverride,
      });
      if (!check.canContinue) {
        throw new BadRequestException({
          message: 'Rights validation failed',
          ...check,
        });
      }
    }

    const catalogIds = [
      ...new Set([
        ...catalogItemIds,
        ...rightsSelections.map((r) => r.catalogItemId),
      ]),
    ];

    const commercialSnapshot: Prisma.InputJsonValue = {
      ...(commercialExpectedValue
        ? { expectedValue: commercialExpectedValue }
        : {}),
      vatIncluded: vatIncluded !== false,
      ...(signedAt ? { signedAt } : {}),
      ...(effectiveAt ? { effectiveAt } : {}),
      ...(paymentModel ? { paymentModel } : {}),
      ...(paymentTerms ? { paymentTerms } : {}),
      ...(deliveryDeadline ? { deliveryDeadline } : {}),
      ...(notes ? { notes } : {}),
      ...(minimumGuarantee ? { minimumGuarantee } : {}),
    };

    const deal = await this.prisma.deal.create({
      data: {
        ...dealData,
        stage: 'lead',
        commercialSnapshot,
        catalogItems: {
          create: catalogIds.map((catalogItemId) => ({ catalogItemId })),
        },
      },
      include: { buyer: true, owner: true, catalogItems: true },
    });

    for (const rs of rightsSelections) {
      await this.prisma.dealCatalogItem.update({
        where: {
          dealId_catalogItemId: {
            dealId: deal.id,
            catalogItemId: rs.catalogItemId,
          },
        },
        data: { rightsSelection: this.toRightsJson(rs) },
      });
    }

    await this.addActivity(deal.id, {
      kind: DealActivityKind.system,
      message: 'Сделка создана',
    });

    return this.findOne(deal.id);
  }

  private toRightsJson(rs: {
    territoryCodes: string[];
    startAt?: string;
    endAt?: string;
    platforms: string[];
    exclusivity: string;
    languageRights?: string[];
    holdback?: string;
  }): Prisma.InputJsonValue {
    return {
      territoryCodes: rs.territoryCodes.map((t) => t.toUpperCase()),
      startAt: rs.startAt ?? null,
      endAt: rs.endAt ?? null,
      platforms: rs.platforms,
      exclusivity: rs.exclusivity,
      languageRights: rs.languageRights ?? [],
      holdback: rs.holdback ?? null,
    };
  }

  async update(id: string, dto: UpdateDealDto) {
    const existing = await this.prisma.deal.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException();

    const data: Prisma.DealUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.kind !== undefined) data.kind = dto.kind;
    if (dto.stage !== undefined) data.stage = dto.stage;
    if (dto.archived !== undefined) data.archived = dto.archived;

    if (dto.commercialSnapshotPatch) {
      const prev =
        (existing.commercialSnapshot as Record<string, unknown> | null) ?? {};
      data.commercialSnapshot = {
        ...prev,
        ...dto.commercialSnapshotPatch,
      } as Prisma.InputJsonValue;
    }

    await this.prisma.deal.update({ where: { id }, data });

    if (dto.archived !== undefined && dto.archived !== existing.archived) {
      await this.addActivity(id, {
        kind: DealActivityKind.system,
        message: dto.archived
          ? 'Сделка перенесена в архив'
          : 'Сделка восстановлена из архива',
      });
    }

    if (dto.rightsSelections?.length) {
      for (const rs of dto.rightsSelections) {
        await this.prisma.dealCatalogItem.upsert({
          where: {
            dealId_catalogItemId: {
              dealId: id,
              catalogItemId: rs.catalogItemId,
            },
          },
          create: {
            dealId: id,
            catalogItemId: rs.catalogItemId,
            rightsSelection: this.toRightsJson(rs),
          },
          update: {
            rightsSelection: this.toRightsJson(rs),
          },
        });
      }
      await this.addActivity(id, {
        kind: DealActivityKind.system,
        message: 'Параметры прав обновлены — пересчитайте сумму и контракт',
      });
    }

    return this.findOne(id);
  }

  async addActivity(dealId: string, dto: DealActivityDto) {
    const deal = await this.prisma.deal.findUnique({ where: { id: dealId } });
    if (!deal) throw new NotFoundException();
    return this.prisma.dealActivity.create({
      data: {
        dealId,
        kind: dto.kind,
        message: dto.message,
        metadata:
          dto.metadata === undefined
            ? undefined
            : (dto.metadata as Prisma.InputJsonValue),
        userId: dto.userId,
      },
    });
  }

  async addActivityFile(
    dealId: string,
    file: Express.Multer.File,
    opts?: { message?: string; userId?: string },
  ) {
    if (!file?.filename) {
      throw new BadRequestException('Файл обязателен');
    }
    const originalName = normalizeUploadedFileName(file.originalname);
    const deal = await this.prisma.deal.findUnique({ where: { id: dealId } });
    if (!deal) throw new NotFoundException();

    const meta = {
      fileName: originalName,
      storedFileName: file.filename,
      mimeType: file.mimetype,
      size: file.size,
    };
    const message = opts?.message?.trim() || `Вложение: ${originalName}`;

    await this.syncUploadedPdfToLatestContractVersion(dealId, file);

    return this.addActivity(dealId, {
      kind: DealActivityKind.file,
      message,
      metadata: meta,
      userId: opts?.userId,
    });
  }

  async uploadDealDocument(
    dealId: string,
    slot: DealDocumentSlot,
    file: Express.Multer.File,
  ) {
    if (!file?.filename) {
      throw new BadRequestException('Файл обязателен');
    }
    const originalName = normalizeUploadedFileName(file.originalname);
    const extRaw = path.extname(file.originalname) || '';
    const extLower = extRaw.toLowerCase();
    const allowed = new Set([
      '.pdf',
      '.doc',
      '.docx',
      '.jpg',
      '.jpeg',
      '.png',
      '.gif',
      '.webp',
      '.tif',
      '.tiff',
      '.txt',
    ]);
    if (!allowed.has(extLower)) {
      if (file.path && existsSync(file.path)) await unlink(file.path).catch(() => {});
      throw new BadRequestException(
        'Допустимые форматы: PDF, DOC/DOCX, изображения, TIFF, TXT',
      );
    }

    const deal = await this.prisma.deal.findUnique({ where: { id: dealId } });
    if (!deal) {
      if (file.path && existsSync(file.path)) await unlink(file.path).catch(() => {});
      throw new NotFoundException();
    }

    const root = process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'uploads');
    const docsDir = path.join(root, 'deals', dealId, 'documents');
    const storedFileName = `${slot}${extLower}`;
    const prev =
      (deal.dealDocuments as Record<string, DealDocumentStored> | null) ?? {};
    const old = prev[slot];
    if (old?.storedFileName && old.storedFileName !== storedFileName) {
      const absOld = path.join(docsDir, old.storedFileName);
      await unlink(absOld).catch(() => {});
    }

    const nextDoc: Record<string, DealDocumentStored> = {
      ...prev,
      [slot]: {
        storedFileName,
        originalName,
        mimeType: file.mimetype,
        size: file.size,
        uploadedAt: new Date().toISOString(),
      },
    };

    await this.prisma.deal.update({
      where: { id: dealId },
      data: { dealDocuments: nextDoc as Prisma.InputJsonValue },
    });

    return this.findOne(dealId);
  }

  async getDealDocumentFile(
    dealId: string,
    slot: DealDocumentSlot,
  ): Promise<StreamableFile> {
    const deal = await this.prisma.deal.findUnique({ where: { id: dealId } });
    if (!deal) throw new NotFoundException();
    const prev =
      (deal.dealDocuments as Record<string, DealDocumentStored> | null) ?? {};
    const meta = prev[slot];
    if (!meta?.storedFileName) throw new NotFoundException();

    const root = process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'uploads');
    const abs = path.join(
      root,
      'deals',
      dealId,
      'documents',
      meta.storedFileName,
    );
    if (!existsSync(abs)) throw new NotFoundException();

    const stream = createReadStream(abs);
    const downloadName = (meta.originalName ?? 'document').replace(/"/g, '');
    return new StreamableFile(stream, {
      type: meta.mimeType ?? 'application/octet-stream',
      disposition: `attachment; filename="${downloadName}"`,
    });
  }

  async deleteDealDocument(dealId: string, slot: DealDocumentSlot) {
    const deal = await this.prisma.deal.findUnique({ where: { id: dealId } });
    if (!deal) throw new NotFoundException();
    const prev =
      (deal.dealDocuments as Record<string, DealDocumentStored> | null) ?? {};
    const meta = prev[slot];
    if (!meta) return this.findOne(dealId);

    const root = process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'uploads');
    const abs = path.join(
      root,
      'deals',
      dealId,
      'documents',
      meta.storedFileName,
    );
    await unlink(abs).catch(() => {});

    const { [slot]: _removed, ...rest } = prev;
    await this.prisma.deal.update({
      where: { id: dealId },
      data: {
        dealDocuments:
          Object.keys(rest).length > 0
            ? (rest as Prisma.InputJsonValue)
            : Prisma.DbNull,
      },
    });

    return this.findOne(dealId);
  }

  async getActivityFile(
    dealId: string,
    activityId: string,
  ): Promise<StreamableFile> {
    const activity = await this.prisma.dealActivity.findFirst({
      where: { id: activityId, dealId, kind: DealActivityKind.file },
    });
    if (!activity?.metadata || typeof activity.metadata !== 'object') {
      throw new NotFoundException();
    }
    const meta = activity.metadata as {
      fileName?: string;
      storedFileName?: string;
      mimeType?: string;
    };
    if (!meta.storedFileName) throw new NotFoundException();

    const root = process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'uploads');
    const abs = path.join(root, 'deals', dealId, meta.storedFileName);
    if (!existsSync(abs)) throw new NotFoundException();

    const stream = createReadStream(abs);
    const downloadName = (meta.fileName ?? 'document').replace(/"/g, '');
    return new StreamableFile(stream, {
      type: meta.mimeType ?? 'application/octet-stream',
      disposition: `attachment; filename="${downloadName}"`,
    });
  }

  async soldHints(catalogItemIds: string[]) {
    if (!catalogItemIds.length)
      return { catalogItemIdsWithSales: [] as string[] };
    const rows = await this.prisma.dealCatalogItem.findMany({
      where: {
        catalogItemId: { in: catalogItemIds },
        deal: { archived: false, stage: { in: CLOSED_DEAL_STAGES } },
      },
      select: { catalogItemId: true },
    });
    return {
      catalogItemIdsWithSales: [...new Set(rows.map((r) => r.catalogItemId))],
    };
  }

  async validateRights(body: ValidateRightsDto) {
    if (body.catalogItemId !== body.selection.catalogItemId) {
      throw new BadRequestException(
        'catalogItemId must match selection.catalogItemId',
      );
    }
    const item = await this.prisma.catalogItem.findUnique({
      where: { id: body.catalogItemId },
      include: { licenseTerms: true },
    });
    if (!item) throw new NotFoundException('Catalog item not found');

    const proposed = parseRightsSelection(this.toRightsJson(body.selection));
    if (!proposed) throw new BadRequestException('Invalid selection shape');

    const licenseGaps: string[] = [];
    for (const code of proposed.territoryCodes) {
      const ok = item.licenseTerms.some((lt) =>
        territoryCoveredByLicenseTerm(code, lt.territoryCode),
      );
      if (!ok) licenseGaps.push(code);
    }

    const blockingConflicts: {
      territory: string;
      reason: string;
      dealId: string;
    }[] = [];
    const partialOverlaps: { territory: string; dealId: string }[] = [];

    const peers = await this.prisma.dealCatalogItem.findMany({
      where: {
        catalogItemId: body.catalogItemId,
        deal: { archived: false, stage: { in: CLOSED_DEAL_STAGES } },
        ...(body.excludeDealId ? { dealId: { not: body.excludeDealId } } : {}),
      },
      include: { deal: { select: { id: true, title: true, stage: true } } },
    });

    for (const row of peers) {
      const existing = parseRightsSelection(row.rightsSelection);
      if (!existing) continue;
      const overlap = territoriesOverlap(
        existing.territoryCodes,
        proposed.territoryCodes,
      );
      if (overlap.length === 0) continue;
      if (isBlockingRightsConflict(existing, proposed)) {
        for (const t of overlap) {
          blockingConflicts.push({
            territory: t,
            reason: 'exclusive_or_sole_overlap',
            dealId: row.dealId,
          });
        }
      } else {
        for (const t of overlap) {
          partialOverlaps.push({ territory: t, dealId: row.dealId });
        }
      }
    }

    const blocked =
      licenseGaps.length > 0 ||
      (!body.adminOverride && blockingConflicts.length > 0);

    return {
      licenseGaps,
      blockingConflicts,
      partialOverlaps,
      canContinue: !blocked,
      allowOverride: body.adminOverride === true,
    };
  }

  async paymentPreview(dealId: string) {
    const deal = await this.findOne(dealId);
    if (!deal) throw new NotFoundException();

    const snap =
      (deal.commercialSnapshot as Record<string, unknown> | null) ?? {};
    const expectedRaw = snap.expectedValue;
    const grossStr =
      typeof expectedRaw === 'string' || typeof expectedRaw === 'number'
        ? String(expectedRaw)
        : '0';
    const gross = new Decimal(grossStr || '0');
    const vatIncluded = snap.vatIncluded !== false;

    const taxProfile = await this.prisma.taxProfile.findFirst({
      where: {
        organizationId: deal.buyerOrgId,
        jurisdiction: deal.buyer.country,
      },
    });

    const counterpartyCountry = (deal.buyer.country || '').trim().toUpperCase();
    const isPurchaseNonKz =
      (deal.kind ?? 'sale') === 'purchase' && counterpartyCountry !== 'KZ';
    const isPurchaseKz =
      (deal.kind ?? 'sale') === 'purchase' && counterpartyCountry === 'KZ';
    const defaultNonResidentRate = new Decimal('0.15');
    const vatRate = new Decimal('0.16');

    let rate =
      taxProfile?.withholdingRateOverride ??
      (deal.buyer.isResident ? new Decimal(0) : defaultNonResidentRate);
    let withholdingTaxAmount = gross.mul(rate);
    let net = vatIncluded
      ? gross.minus(withholdingTaxAmount)
      : gross.mul(vatRate.plus(1));
    let taxPercentLabel = `${rate.mul(100).toFixed(2)}%`;
    let taxNote = deal.buyer.isResident
      ? 'Резидент: удержание по умолчанию 0 (настройте TaxProfile при необходимости).'
      : `Нерезидент: удержание ${rate.mul(100).toFixed(0)}% (TaxProfile или ставка по умолчанию).`;

    if (isPurchaseNonKz) {
      const kpnRate = new Decimal('0.10');
      const kpnAmount = gross.mul(kpnRate);
      if (vatIncluded) {
        rate = kpnRate;
        withholdingTaxAmount = kpnAmount;
        net = gross.minus(kpnAmount);
        taxPercentLabel = 'КПН 10% (удержание)';
        taxNote = 'С галочкой «С КПН»: NET = сумма - 10% КПН от GROSS.';
      } else {
        rate = new Decimal(0);
        withholdingTaxAmount = new Decimal(0);
        net = gross;
        taxPercentLabel = '0.00%';
        taxNote = 'Без галочки «С КПН»: налог не возникает, NET = GROSS.';
      }
    }
    if (isPurchaseKz) {
      rate = new Decimal(0);
      withholdingTaxAmount = new Decimal(0);
      net = vatIncluded ? gross.minus(gross.mul(vatRate)) : gross;
      taxPercentLabel = '0.00%';
      taxNote = vatIncluded
        ? 'Правообладатель KZ и с НДС: налог не возникает, NET = GROSS - 16%.'
        : 'Правообладатель KZ и без НДС: налог не возникает, NET = GROSS.';
    }

    const projectAdministrationEnabled = snap.projectAdministration === true;
    const projectAdministrationDeduction = new Decimal('500000');
    if (projectAdministrationEnabled) {
      net = net.minus(projectAdministrationDeduction);
    }

    const payments = deal.payments;
    const paidSum = payments
      .filter((p) => p.status === 'paid' || p.status === 'partially_paid')
      .reduce((acc, p) => acc.add(p.amount), new Decimal(0));

    const contractFx = deal.contracts[0];
    const paymentCurrencyMismatch =
      contractFx && contractFx.currency !== deal.currency;

    return {
      gross: gross.toString(),
      taxRate: rate.toString(),
      taxPercentLabel,
      withholdingTaxAmount: withholdingTaxAmount.toString(),
      net: net.toString(),
      vatIncluded,
      projectAdministrationEnabled,
      projectAdministrationDeduction: projectAdministrationEnabled
        ? projectAdministrationDeduction.toString()
        : '0',
      currency: deal.currency,
      buyerIsResident: deal.buyer.isResident,
      taxNote,
      payments: payments.map((p) => ({
        id: p.id,
        amount: p.amount.toString(),
        currency: p.currency,
        status: p.status,
        paidAt: p.paidAt,
      })),
      paidSum: paidSum.toString(),
      partialPaymentHint: payments.some((p) => p.status === 'partially_paid'),
      fxNote: paymentCurrencyMismatch
        ? 'Оплата в другой валюте: зафиксируйте курс в контракте (fxRateFixed / fxRateSource).'
        : null,
    };
  }

  /** Безвозвратное удаление: только архивная сделка; вызывать после проверки admin-email. */
  async removeDeal(dealId: string) {
    const deal = await this.prisma.deal.findUnique({ where: { id: dealId } });
    if (!deal) throw new NotFoundException();
    if (!deal.archived) {
      throw new BadRequestException('Удалить можно только архивную сделку');
    }

    const contracts = await this.prisma.contract.findMany({
      where: { dealId },
      select: { id: true },
    });
    const cids = contracts.map((c) => c.id);

    await this.prisma.$transaction(async (tx) => {
      await tx.task.deleteMany({
        where: {
          OR: [
            { linkedEntityType: 'deal', linkedEntityId: dealId },
            ...(cids.length
              ? [
                  {
                    linkedEntityType: 'contract',
                    linkedEntityId: { in: cids },
                  },
                ]
              : []),
          ],
        },
      });

      if (cids.length) {
        await tx.payout.deleteMany({ where: { contractId: { in: cids } } });
        await tx.royaltyLine.deleteMany({
          where: { contractId: { in: cids } },
        });
        await tx.contractVersion.deleteMany({
          where: { contractId: { in: cids } },
        });
        await tx.payment.deleteMany({ where: { contractId: { in: cids } } });
        await tx.contract.deleteMany({ where: { id: { in: cids } } });
      }

      await tx.payment.deleteMany({ where: { dealId } });
      await tx.dealCatalogItem.deleteMany({ where: { dealId } });
      await tx.dealActivity.deleteMany({ where: { dealId } });
      await tx.deal.delete({ where: { id: dealId } });
    });

    try {
      const root =
        process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'uploads');
      await rm(path.join(root, 'deals', dealId), {
        recursive: true,
        force: true,
      });
    } catch {
      /* ignore */
    }

    return { ok: true, id: dealId };
  }

  /**
   * Generates a Google Drive folder for a specific catalog item in the deal.
   * Structure: <RightsHolderName> / <ContentTitle>
   * Stores the resulting URL in commercialSnapshot.driveFolders[catalogItemId].
   */
  async generateDriveFolder(
    dealId: string,
    email: string,
    catalogItemId: string,
  ): Promise<{ folderUrl: string }> {
    if (!this.drive) {
      throw new BadRequestException(
        'Интеграция с Google Drive не настроена на сервере',
      );
    }

    const deal = await this.prisma.deal.findUnique({
      where: { id: dealId },
      include: {
        catalogItems: {
          where: { catalogItemId },
          include: {
            catalogItem: {
              include: { rightsHolder: true },
            },
          },
        },
      },
    });

    if (!deal) throw new NotFoundException('Сделка не найдена');

    const item = deal.catalogItems[0];
    if (!item) {
      throw new BadRequestException(
        'Позиция каталога не найдена в этой сделке',
      );
    }

    const rightsHolderName = item.catalogItem.rightsHolder.legalName;
    const contentTitle = item.catalogItem.title;

    const folderUrl = await this.drive.createDealFolder({
      rightsHolderName,
      contentTitle,
      email,
    });

    // Persist the URL in commercialSnapshot.driveFolders[catalogItemId]
    const existingSnapshot =
      typeof deal.commercialSnapshot === 'object' &&
      deal.commercialSnapshot !== null
        ? (deal.commercialSnapshot as Record<string, unknown>)
        : {};

    const existingFolders =
      typeof existingSnapshot.driveFolders === 'object' &&
      existingSnapshot.driveFolders !== null
        ? (existingSnapshot.driveFolders as Record<string, string>)
        : {};

    await this.prisma.deal.update({
      where: { id: dealId },
      data: {
        commercialSnapshot: {
          ...existingSnapshot,
          driveFolders: {
            ...existingFolders,
            [catalogItemId]: folderUrl,
          },
        },
      },
    });

    return { folderUrl };
  }
}
