"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DealsService = void 0;
const common_1 = require("@nestjs/common");
const fs_1 = require("fs");
const path = __importStar(require("path"));
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
const rights_validation_1 = require("./rights-validation");
const crypto_1 = require("crypto");
const library_1 = require("@prisma/client/runtime/library");
function normalizeUploadedFileName(name) {
    const raw = (name || '').trim();
    if (!raw)
        return 'document';
    const looksMojibake = /[ÐÑÃÂ]/.test(raw) && !/[А-Яа-яЁё]/.test(raw);
    if (!looksMojibake)
        return raw;
    try {
        const fixed = Buffer.from(raw, 'latin1').toString('utf8').trim();
        return fixed || raw;
    }
    catch {
        return raw;
    }
}
let DealsService = class DealsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async syncUploadedPdfToLatestContractVersion(dealId, file) {
        const ext = (path.extname(file.originalname) || '').toLowerCase();
        if (ext !== '.pdf')
            return;
        const contract = await this.prisma.contract.findFirst({
            where: { dealId, archived: false, clientCabinetSigned: false },
            orderBy: { updatedAt: 'desc' },
            select: { id: true, templateId: true },
        });
        if (!contract)
            return;
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
        (0, fs_1.mkdirSync)(path.dirname(absDst), { recursive: true });
        (0, fs_1.copyFileSync)(absSrc, absDst);
        const sha256 = (0, crypto_1.createHash)('sha256')
            .update((0, fs_1.readFileSync)(absDst))
            .digest('hex');
        await this.prisma.contractVersion.create({
            data: {
                contractId: contract.id,
                version: nextVersion,
                storageKey,
                sha256,
                templateId: contract.templateId ?? 'default-template',
            },
        });
    }
    findAll(filters) {
        const where = {};
        where.archived = filters?.archived === true;
        if (filters?.stage &&
            Object.values(client_1.DealStage).includes(filters.stage)) {
            where.stage = filters.stage;
        }
        if (filters?.kind &&
            Object.values(client_1.DealKind).includes(filters.kind)) {
            where.kind = filters.kind;
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
        const take = filters?.take != null
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
    async duplicate(sourceId) {
        const src = await this.prisma.deal.findUnique({
            where: { id: sourceId },
            include: { catalogItems: true },
        });
        if (!src)
            throw new common_1.NotFoundException();
        const snap = src.commercialSnapshot;
        const ev = snap?.expectedValue;
        const commercialExpectedValue = typeof ev === 'string' || typeof ev === 'number' ? String(ev) : undefined;
        const rightsSelections = src.catalogItems.map((row) => {
            const p = (0, rights_validation_1.parseRightsSelection)(row.rightsSelection);
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
                platforms: [client_1.Platform.TV],
                exclusivity: client_1.Exclusivity.non_exclusive,
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
    findOne(id) {
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
    dealFingerprint(deal) {
        const payload = JSON.stringify({
            title: deal.title,
            buyerOrgId: deal.buyerOrgId,
            currency: deal.currency,
            lines: deal.catalogItems.map((l) => ({
                id: l.catalogItemId,
                r: l.rightsSelection,
            })),
        });
        return (0, crypto_1.createHash)('sha256').update(payload).digest('hex').slice(0, 32);
    }
    async create(data) {
        const { catalogItemIds = [], rightsSelections = [], commercialExpectedValue, vatIncluded = true, adminOverride, ...dealData } = data;
        for (const rs of rightsSelections ?? []) {
            const check = await this.validateRights({
                catalogItemId: rs.catalogItemId,
                selection: rs,
                adminOverride,
            });
            if (!check.canContinue) {
                throw new common_1.BadRequestException({
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
        const commercialSnapshot = {
            ...(commercialExpectedValue
                ? { expectedValue: commercialExpectedValue }
                : {}),
            vatIncluded: vatIncluded !== false,
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
            kind: client_1.DealActivityKind.system,
            message: 'Сделка создана',
        });
        return this.findOne(deal.id);
    }
    toRightsJson(rs) {
        return {
            territoryCodes: rs.territoryCodes.map((t) => t.toUpperCase()),
            startAt: rs.startAt ?? null,
            endAt: rs.endAt ?? null,
            platforms: rs.platforms,
            exclusivity: rs.exclusivity,
        };
    }
    async update(id, dto) {
        const existing = await this.prisma.deal.findUnique({ where: { id } });
        if (!existing)
            throw new common_1.NotFoundException();
        const data = {};
        if (dto.title !== undefined)
            data.title = dto.title;
        if (dto.kind !== undefined)
            data.kind = dto.kind;
        if (dto.stage !== undefined)
            data.stage = dto.stage;
        if (dto.archived !== undefined)
            data.archived = dto.archived;
        if (dto.commercialSnapshotPatch) {
            const prev = existing.commercialSnapshot ?? {};
            data.commercialSnapshot = {
                ...prev,
                ...dto.commercialSnapshotPatch,
            };
        }
        await this.prisma.deal.update({ where: { id }, data });
        if (dto.archived !== undefined && dto.archived !== existing.archived) {
            await this.addActivity(id, {
                kind: client_1.DealActivityKind.system,
                message: dto.archived
                    ? 'Сделка перенесена в архив'
                    : 'Сделка восстановлена из архива',
            });
        }
        if (dto.rightsSelections?.length) {
            for (const rs of dto.rightsSelections) {
                const link = await this.prisma.dealCatalogItem.findUnique({
                    where: {
                        dealId_catalogItemId: {
                            dealId: id,
                            catalogItemId: rs.catalogItemId,
                        },
                    },
                });
                if (!link) {
                    await this.prisma.dealCatalogItem.create({
                        data: {
                            dealId: id,
                            catalogItemId: rs.catalogItemId,
                            rightsSelection: this.toRightsJson(rs),
                        },
                    });
                }
                else {
                    await this.prisma.dealCatalogItem.update({
                        where: {
                            dealId_catalogItemId: {
                                dealId: id,
                                catalogItemId: rs.catalogItemId,
                            },
                        },
                        data: { rightsSelection: this.toRightsJson(rs) },
                    });
                }
            }
            await this.addActivity(id, {
                kind: client_1.DealActivityKind.system,
                message: 'Параметры прав обновлены — пересчитайте сумму и контракт',
            });
        }
        return this.findOne(id);
    }
    async addActivity(dealId, dto) {
        const deal = await this.prisma.deal.findUnique({ where: { id: dealId } });
        if (!deal)
            throw new common_1.NotFoundException();
        return this.prisma.dealActivity.create({
            data: {
                dealId,
                kind: dto.kind,
                message: dto.message,
                metadata: dto.metadata === undefined
                    ? undefined
                    : dto.metadata,
                userId: dto.userId,
            },
        });
    }
    async addActivityFile(dealId, file, opts) {
        if (!file?.filename) {
            throw new common_1.BadRequestException('Файл обязателен');
        }
        const originalName = normalizeUploadedFileName(file.originalname);
        const deal = await this.prisma.deal.findUnique({ where: { id: dealId } });
        if (!deal)
            throw new common_1.NotFoundException();
        const meta = {
            fileName: originalName,
            storedFileName: file.filename,
            mimeType: file.mimetype,
            size: file.size,
        };
        const message = opts?.message?.trim() || `Вложение: ${originalName}`;
        await this.syncUploadedPdfToLatestContractVersion(dealId, file);
        return this.addActivity(dealId, {
            kind: client_1.DealActivityKind.file,
            message,
            metadata: meta,
            userId: opts?.userId,
        });
    }
    async uploadDealDocument(dealId, slot, file) {
        if (!file?.filename) {
            throw new common_1.BadRequestException('Файл обязателен');
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
            if (file.path && (0, fs_1.existsSync)(file.path))
                (0, fs_1.unlinkSync)(file.path);
            throw new common_1.BadRequestException('Допустимые форматы: PDF, DOC/DOCX, изображения, TIFF, TXT');
        }
        const deal = await this.prisma.deal.findUnique({ where: { id: dealId } });
        if (!deal) {
            if (file.path && (0, fs_1.existsSync)(file.path))
                (0, fs_1.unlinkSync)(file.path);
            throw new common_1.NotFoundException();
        }
        const root = process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'uploads');
        const docsDir = path.join(root, 'deals', dealId, 'documents');
        const storedFileName = `${slot}${extLower}`;
        const prev = deal.dealDocuments ?? {};
        const old = prev[slot];
        if (old?.storedFileName && old.storedFileName !== storedFileName) {
            const absOld = path.join(docsDir, old.storedFileName);
            if ((0, fs_1.existsSync)(absOld))
                (0, fs_1.unlinkSync)(absOld);
        }
        const nextDoc = {
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
            data: { dealDocuments: nextDoc },
        });
        return this.findOne(dealId);
    }
    async getDealDocumentFile(dealId, slot) {
        const deal = await this.prisma.deal.findUnique({ where: { id: dealId } });
        if (!deal)
            throw new common_1.NotFoundException();
        const prev = deal.dealDocuments ?? {};
        const meta = prev[slot];
        if (!meta?.storedFileName)
            throw new common_1.NotFoundException();
        const root = process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'uploads');
        const abs = path.join(root, 'deals', dealId, 'documents', meta.storedFileName);
        if (!(0, fs_1.existsSync)(abs))
            throw new common_1.NotFoundException();
        const stream = (0, fs_1.createReadStream)(abs);
        const downloadName = (meta.originalName ?? 'document').replace(/"/g, '');
        return new common_1.StreamableFile(stream, {
            type: meta.mimeType ?? 'application/octet-stream',
            disposition: `attachment; filename="${downloadName}"`,
        });
    }
    async deleteDealDocument(dealId, slot) {
        const deal = await this.prisma.deal.findUnique({ where: { id: dealId } });
        if (!deal)
            throw new common_1.NotFoundException();
        const prev = deal.dealDocuments ?? {};
        const meta = prev[slot];
        if (!meta)
            return this.findOne(dealId);
        const root = process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'uploads');
        const abs = path.join(root, 'deals', dealId, 'documents', meta.storedFileName);
        if ((0, fs_1.existsSync)(abs))
            (0, fs_1.unlinkSync)(abs);
        const { [slot]: _removed, ...rest } = prev;
        await this.prisma.deal.update({
            where: { id: dealId },
            data: {
                dealDocuments: Object.keys(rest).length > 0
                    ? rest
                    : client_1.Prisma.DbNull,
            },
        });
        return this.findOne(dealId);
    }
    async getActivityFile(dealId, activityId) {
        const activity = await this.prisma.dealActivity.findFirst({
            where: { id: activityId, dealId, kind: client_1.DealActivityKind.file },
        });
        if (!activity?.metadata || typeof activity.metadata !== 'object') {
            throw new common_1.NotFoundException();
        }
        const meta = activity.metadata;
        if (!meta.storedFileName)
            throw new common_1.NotFoundException();
        const root = process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'uploads');
        const abs = path.join(root, 'deals', dealId, meta.storedFileName);
        if (!(0, fs_1.existsSync)(abs))
            throw new common_1.NotFoundException();
        const stream = (0, fs_1.createReadStream)(abs);
        const downloadName = (meta.fileName ?? 'document').replace(/"/g, '');
        return new common_1.StreamableFile(stream, {
            type: meta.mimeType ?? 'application/octet-stream',
            disposition: `attachment; filename="${downloadName}"`,
        });
    }
    async soldHints(catalogItemIds) {
        if (!catalogItemIds.length)
            return { catalogItemIdsWithSales: [] };
        const rows = await this.prisma.dealCatalogItem.findMany({
            where: {
                catalogItemId: { in: catalogItemIds },
                deal: { archived: false, stage: { in: rights_validation_1.CLOSED_DEAL_STAGES } },
            },
            select: { catalogItemId: true },
        });
        return {
            catalogItemIdsWithSales: [...new Set(rows.map((r) => r.catalogItemId))],
        };
    }
    async validateRights(body) {
        if (body.catalogItemId !== body.selection.catalogItemId) {
            throw new common_1.BadRequestException('catalogItemId must match selection.catalogItemId');
        }
        const item = await this.prisma.catalogItem.findUnique({
            where: { id: body.catalogItemId },
            include: { licenseTerms: true },
        });
        if (!item)
            throw new common_1.NotFoundException('Catalog item not found');
        const proposed = (0, rights_validation_1.parseRightsSelection)(this.toRightsJson(body.selection));
        if (!proposed)
            throw new common_1.BadRequestException('Invalid selection shape');
        const licenseGaps = [];
        for (const code of proposed.territoryCodes) {
            const ok = item.licenseTerms.some((lt) => (0, rights_validation_1.territoryCoveredByLicenseTerm)(code, lt.territoryCode));
            if (!ok)
                licenseGaps.push(code);
        }
        const blockingConflicts = [];
        const partialOverlaps = [];
        const peers = await this.prisma.dealCatalogItem.findMany({
            where: {
                catalogItemId: body.catalogItemId,
                deal: { archived: false, stage: { in: rights_validation_1.CLOSED_DEAL_STAGES } },
                ...(body.excludeDealId ? { dealId: { not: body.excludeDealId } } : {}),
            },
            include: { deal: { select: { id: true, title: true, stage: true } } },
        });
        for (const row of peers) {
            const existing = (0, rights_validation_1.parseRightsSelection)(row.rightsSelection);
            if (!existing)
                continue;
            const overlap = (0, rights_validation_1.territoriesOverlap)(existing.territoryCodes, proposed.territoryCodes);
            if (overlap.length === 0)
                continue;
            if ((0, rights_validation_1.isBlockingRightsConflict)(existing, proposed)) {
                for (const t of overlap) {
                    blockingConflicts.push({
                        territory: t,
                        reason: 'exclusive_or_sole_overlap',
                        dealId: row.dealId,
                    });
                }
            }
            else {
                for (const t of overlap) {
                    partialOverlaps.push({ territory: t, dealId: row.dealId });
                }
            }
        }
        const blocked = licenseGaps.length > 0 ||
            (!body.adminOverride && blockingConflicts.length > 0);
        return {
            licenseGaps,
            blockingConflicts,
            partialOverlaps,
            canContinue: !blocked,
            allowOverride: body.adminOverride === true,
        };
    }
    async paymentPreview(dealId) {
        const deal = await this.findOne(dealId);
        if (!deal)
            throw new common_1.NotFoundException();
        const snap = deal.commercialSnapshot ?? {};
        const expectedRaw = snap.expectedValue;
        const grossStr = typeof expectedRaw === 'string' || typeof expectedRaw === 'number'
            ? String(expectedRaw)
            : '0';
        const gross = new library_1.Decimal(grossStr || '0');
        const vatIncluded = snap.vatIncluded !== false;
        const taxProfile = await this.prisma.taxProfile.findFirst({
            where: {
                organizationId: deal.buyerOrgId,
                jurisdiction: deal.buyer.country,
            },
        });
        const counterpartyCountry = (deal.buyer.country || '').trim().toUpperCase();
        const isPurchaseNonKz = (deal.kind ?? 'sale') === 'purchase' && counterpartyCountry !== 'KZ';
        const isPurchaseKz = (deal.kind ?? 'sale') === 'purchase' && counterpartyCountry === 'KZ';
        const defaultNonResidentRate = new library_1.Decimal('0.15');
        const vatRate = new library_1.Decimal('0.16');
        let rate = taxProfile?.withholdingRateOverride ??
            (deal.buyer.isResident ? new library_1.Decimal(0) : defaultNonResidentRate);
        let withholdingTaxAmount = gross.mul(rate);
        let net = vatIncluded
            ? gross.minus(withholdingTaxAmount)
            : gross.mul(vatRate.plus(1));
        let taxPercentLabel = `${rate.mul(100).toFixed(2)}%`;
        let taxNote = deal.buyer.isResident
            ? 'Резидент: удержание по умолчанию 0 (настройте TaxProfile при необходимости).'
            : `Нерезидент: удержание ${rate.mul(100).toFixed(0)}% (TaxProfile или ставка по умолчанию).`;
        if (isPurchaseNonKz) {
            const kpnRate = new library_1.Decimal('0.10');
            const kpnAmount = gross.mul(kpnRate);
            if (vatIncluded) {
                rate = kpnRate;
                withholdingTaxAmount = kpnAmount;
                net = gross.minus(kpnAmount);
                taxPercentLabel = 'КПН 10% (удержание)';
                taxNote = 'С галочкой «С КПН»: NET = сумма - 10% КПН от GROSS.';
            }
            else {
                rate = new library_1.Decimal(0);
                withholdingTaxAmount = new library_1.Decimal(0);
                net = gross;
                taxPercentLabel = '0.00%';
                taxNote = 'Без галочки «С КПН»: налог не возникает, NET = GROSS.';
            }
        }
        if (isPurchaseKz) {
            rate = new library_1.Decimal(0);
            withholdingTaxAmount = new library_1.Decimal(0);
            net = vatIncluded ? gross.minus(gross.mul(vatRate)) : gross;
            taxPercentLabel = '0.00%';
            taxNote = vatIncluded
                ? 'Правообладатель KZ и с НДС: налог не возникает, NET = GROSS - 16%.'
                : 'Правообладатель KZ и без НДС: налог не возникает, NET = GROSS.';
        }
        const projectAdministrationEnabled = snap.projectAdministration === true;
        const projectAdministrationDeduction = new library_1.Decimal('500000');
        if (projectAdministrationEnabled) {
            net = net.minus(projectAdministrationDeduction);
        }
        const payments = deal.payments;
        const paidSum = payments
            .filter((p) => p.status === 'paid' || p.status === 'partially_paid')
            .reduce((acc, p) => acc.add(p.amount), new library_1.Decimal(0));
        const contractFx = deal.contracts[0];
        const paymentCurrencyMismatch = contractFx && contractFx.currency !== deal.currency;
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
    async removeDeal(dealId) {
        const deal = await this.prisma.deal.findUnique({ where: { id: dealId } });
        if (!deal)
            throw new common_1.NotFoundException();
        if (!deal.archived) {
            throw new common_1.BadRequestException('Удалить можно только архивную сделку');
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
            const root = process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'uploads');
            (0, fs_1.rmSync)(path.join(root, 'deals', dealId), {
                recursive: true,
                force: true,
            });
        }
        catch {
        }
        return { ok: true, id: dealId };
    }
};
exports.DealsService = DealsService;
exports.DealsService = DealsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], DealsService);
//# sourceMappingURL=deals.service.js.map