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
exports.CatalogService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const client_1 = require("@prisma/client");
const fs_1 = require("fs");
const path = __importStar(require("path"));
const prisma_service_1 = require("../prisma/prisma.service");
const transliterate_cyrillic_latin_1 = require("../common/transliterate-cyrillic-latin");
function uploadRoot() {
    return process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'uploads');
}
function posterMimeFromName(fileName) {
    const ext = path.extname(fileName).toLowerCase();
    if (ext === '.png')
        return 'image/png';
    if (ext === '.webp')
        return 'image/webp';
    if (ext === '.gif')
        return 'image/gif';
    return 'image/jpeg';
}
let CatalogService = class CatalogService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async allocateUniqueSlug(desired) {
        const normalized = (0, transliterate_cyrillic_latin_1.transliterateCyrillicToLatin)(desired.trim())
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9_-]/g, '')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
            .slice(0, 180) || 'item';
        let candidate = normalized;
        for (let attempt = 0; attempt < 12; attempt++) {
            const taken = await this.prisma.catalogItem.findUnique({
                where: { slug: candidate },
                select: { id: true },
            });
            if (!taken)
                return candidate;
            const suffix = (0, crypto_1.randomBytes)(3).toString('hex');
            candidate = `${normalized}-${suffix}`.slice(0, 200);
        }
        return `${normalized}-${(0, crypto_1.randomBytes)(8).toString('hex')}`.slice(0, 200);
    }
    findAll() {
        return this.prisma.catalogItem.findMany({
            orderBy: { updatedAt: 'desc' },
            include: { rightsHolder: true, licenseTerms: true },
        });
    }
    findForBuyerCatalog(filters) {
        const where = {};
        const pickedIds = filters.catalogItemIds?.filter(Boolean) ?? [];
        if (pickedIds.length) {
            where.id = { in: pickedIds };
        }
        if (filters.rightsHolderOrgId?.trim()) {
            where.rightsHolderOrgId = filters.rightsHolderOrgId.trim();
        }
        if (filters.status?.trim() &&
            Object.values(client_1.CatalogItemStatus).includes(filters.status)) {
            where.status = filters.status;
        }
        else {
            where.status = { not: client_1.CatalogItemStatus.archived };
        }
        if (filters.assetType?.trim() &&
            Object.values(client_1.AssetType).includes(filters.assetType)) {
            where.assetType = filters.assetType;
        }
        if (filters.q?.trim()) {
            const q = filters.q.trim();
            where.OR = [
                { title: { contains: q, mode: 'insensitive' } },
                { slug: { contains: q, mode: 'insensitive' } },
                { rightsHolder: { legalName: { contains: q, mode: 'insensitive' } } },
                {
                    licenseTerms: {
                        some: { territoryCode: { contains: q, mode: 'insensitive' } },
                    },
                },
            ];
        }
        return this.prisma.catalogItem
            .findMany({
            where,
            orderBy: { title: 'asc' },
            include: { rightsHolder: true, licenseTerms: true },
        })
            .then((rows) => {
            if (!pickedIds.length)
                return rows;
            const order = new Map(pickedIds.map((id, i) => [id, i]));
            return [...rows].sort((a, b) => (order.get(a.id) ?? 9999) - (order.get(b.id) ?? 9999));
        });
    }
    async findOne(id) {
        const item = await this.prisma.catalogItem.findUnique({
            where: { id },
            include: { rightsHolder: true, licenseTerms: true },
        });
        if (!item)
            throw new common_1.NotFoundException();
        return item;
    }
    async update(id, dto) {
        const existing = await this.prisma.catalogItem.findUnique({
            where: { id },
            select: { id: true, metadata: true },
        });
        if (!existing)
            throw new common_1.NotFoundException();
        const data = {};
        if (dto.title !== undefined)
            data.title = dto.title;
        if (dto.status !== undefined)
            data.status = dto.status;
        if (dto.metadataPatch !== undefined) {
            const prev = existing.metadata ?? {};
            data.metadata = {
                ...prev,
                ...dto.metadataPatch,
            };
        }
        return this.prisma.$transaction(async (tx) => {
            if (dto.licenseTerms !== undefined) {
                await tx.licenseTerm.deleteMany({ where: { catalogItemId: id } });
            }
            return tx.catalogItem.update({
                where: { id },
                data: {
                    ...data,
                    ...(dto.licenseTerms !== undefined
                        ? {
                            licenseTerms: {
                                create: dto.licenseTerms.map((t) => ({
                                    territoryCode: t.territoryCode,
                                    startAt: t.startAt ? new Date(t.startAt) : undefined,
                                    endAt: t.endAt ? new Date(t.endAt) : undefined,
                                    durationMonths: t.durationMonths,
                                    exclusivity: t.exclusivity,
                                    platforms: t.platforms,
                                    sublicensingAllowed: t.sublicensingAllowed ?? false,
                                    languageRights: t.languageRights,
                                })),
                            },
                        }
                        : {}),
                },
                include: { rightsHolder: true, licenseTerms: true },
            });
        });
    }
    async create(dto) {
        const { licenseTerms, ...item } = dto;
        const terms = licenseTerms.map((t) => ({
            territoryCode: t.territoryCode,
            startAt: t.startAt ? new Date(t.startAt) : undefined,
            endAt: t.endAt ? new Date(t.endAt) : undefined,
            durationMonths: t.durationMonths,
            exclusivity: t.exclusivity,
            platforms: t.platforms,
            sublicensingAllowed: t.sublicensingAllowed ?? false,
            languageRights: t.languageRights,
        }));
        const slug = await this.allocateUniqueSlug(item.slug);
        return this.prisma.catalogItem.create({
            data: {
                title: item.title,
                slug,
                assetType: item.assetType,
                rightsHolderOrgId: item.rightsHolderOrgId,
                metadata: item.metadata === undefined
                    ? undefined
                    : item.metadata,
                licenseTerms: { create: terms },
            },
            include: { licenseTerms: true, rightsHolder: true },
        });
    }
    async attachPoster(itemId, file) {
        if (!file?.filename) {
            throw new common_1.BadRequestException('Файл не сохранён');
        }
        if (!/^image\/(jpeg|png|gif|webp)$/i.test(file.mimetype)) {
            throw new common_1.BadRequestException('Допустимы только изображения JPEG, PNG, GIF, WebP');
        }
        const row = await this.prisma.catalogItem.findUnique({
            where: { id: itemId },
            select: { id: true, posterFileName: true },
        });
        if (!row)
            throw new common_1.NotFoundException();
        const root = uploadRoot();
        const dir = path.join(root, 'catalog', itemId);
        const newPath = path.join(dir, file.filename);
        if (row.posterFileName && row.posterFileName !== file.filename) {
            const oldPath = path.join(dir, row.posterFileName);
            if ((0, fs_1.existsSync)(oldPath)) {
                try {
                    (0, fs_1.unlinkSync)(oldPath);
                }
                catch {
                }
            }
        }
        if (!(0, fs_1.existsSync)(newPath)) {
            throw new common_1.BadRequestException('Файл постера не найден на диске');
        }
        await this.prisma.catalogItem.update({
            where: { id: itemId },
            data: { posterFileName: file.filename },
        });
        return this.findOne(itemId);
    }
    async getPosterFile(itemId) {
        const row = await this.prisma.catalogItem.findUnique({
            where: { id: itemId },
            select: { posterFileName: true },
        });
        if (!row?.posterFileName)
            throw new common_1.NotFoundException();
        const abs = path.join(uploadRoot(), 'catalog', itemId, row.posterFileName);
        if (!(0, fs_1.existsSync)(abs))
            throw new common_1.NotFoundException();
        const stream = (0, fs_1.createReadStream)(abs);
        return new common_1.StreamableFile(stream, {
            type: posterMimeFromName(row.posterFileName),
            disposition: 'inline',
        });
    }
    async removeCatalogItem(id) {
        const row = await this.prisma.catalogItem.findUnique({ where: { id } });
        if (!row)
            throw new common_1.NotFoundException();
        if (row.status !== client_1.CatalogItemStatus.archived) {
            throw new common_1.BadRequestException('Удалить можно только единицу в статусе «Архив»');
        }
        await this.prisma.catalogItem.delete({ where: { id } });
        const dir = path.join(uploadRoot(), 'catalog', id);
        try {
            (0, fs_1.rmSync)(dir, { recursive: true, force: true });
        }
        catch {
        }
        return { ok: true, id };
    }
};
exports.CatalogService = CatalogService;
exports.CatalogService = CatalogService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], CatalogService);
//# sourceMappingURL=catalog.service.js.map