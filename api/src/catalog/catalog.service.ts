import {
  BadRequestException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { AssetType, CatalogItemStatus, Prisma } from '@prisma/client';
import { createReadStream, existsSync } from 'fs';
import { rm, unlink } from 'fs/promises';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCatalogItemDto } from './dto/create-catalog-item.dto';
import { UpdateCatalogItemDto } from './dto/update-catalog-item.dto';
import { transliterateCyrillicToLatin } from '../common/transliterate-cyrillic-latin';

function uploadRoot(): string {
  return process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'uploads');
}

function posterMimeFromName(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  return 'image/jpeg';
}

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  /** Нормализация и уникальный slug (P2002 при коллизии). */
  private async allocateUniqueSlug(desired: string): Promise<string> {
    const normalized =
      transliterateCyrillicToLatin(desired.trim())
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
      if (!taken) return candidate;
      const suffix = randomBytes(3).toString('hex');
      candidate = `${normalized}-${suffix}`.slice(0, 200);
    }
    return `${normalized}-${randomBytes(8).toString('hex')}`.slice(0, 200);
  }

  findAll(opts?: { skip?: number; take?: number }) {
    const take = Math.min(opts?.take ?? 200, 500);
    const skip = opts?.skip ?? 0;
    return this.prisma.catalogItem.findMany({
      orderBy: { updatedAt: 'desc' },
      include: { rightsHolder: true, licenseTerms: true },
      skip,
      take,
    });
  }

  /** Выборка для PDF-каталога покупателя (те же фильтры, что на вкладке «Контент»). */
  findForBuyerCatalog(filters: {
    q?: string;
    assetType?: string;
    status?: string;
    rightsHolderOrgId?: string;
    /** Если задано — только эти id (пересечение с фильтрами). Порядок в PDF как в массиве. */
    catalogItemIds?: string[];
  }) {
    const where: Prisma.CatalogItemWhereInput = {};
    const pickedIds = filters.catalogItemIds?.filter(Boolean) ?? [];
    if (pickedIds.length) {
      where.id = { in: pickedIds };
    }
    if (filters.rightsHolderOrgId?.trim()) {
      where.rightsHolderOrgId = filters.rightsHolderOrgId.trim();
    }
    if (
      filters.status?.trim() &&
      Object.values(CatalogItemStatus).includes(
        filters.status as CatalogItemStatus,
      )
    ) {
      where.status = filters.status as CatalogItemStatus;
    } else {
      where.status = { not: CatalogItemStatus.archived };
    }
    if (
      filters.assetType?.trim() &&
      Object.values(AssetType).includes(filters.assetType as AssetType)
    ) {
      where.assetType = filters.assetType as AssetType;
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
        if (!pickedIds.length) return rows;
        const order = new Map(pickedIds.map((id, i) => [id, i]));
        return [...rows].sort(
          (a, b) => (order.get(a.id) ?? 9999) - (order.get(b.id) ?? 9999),
        );
      });
  }

  async findOne(id: string) {
    const item = await this.prisma.catalogItem.findUnique({
      where: { id },
      include: { rightsHolder: true, licenseTerms: true },
    });
    if (!item) throw new NotFoundException();
    return item;
  }

  async update(id: string, dto: UpdateCatalogItemDto) {
    const existing = await this.prisma.catalogItem.findUnique({
      where: { id },
      select: { id: true, metadata: true },
    });
    if (!existing) throw new NotFoundException();
    const data: Prisma.CatalogItemUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.metadataPatch !== undefined) {
      const prev = (existing.metadata as Record<string, unknown> | null) ?? {};
      data.metadata = {
        ...prev,
        ...dto.metadataPatch,
      } as Prisma.InputJsonValue;
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

  async create(dto: CreateCatalogItemDto) {
    const { licenseTerms, ...item } = dto;
    const terms: Prisma.LicenseTermCreateWithoutCatalogItemInput[] =
      licenseTerms.map((t) => ({
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
        metadata:
          item.metadata === undefined
            ? undefined
            : (item.metadata as Prisma.InputJsonValue),
        licenseTerms: { create: terms },
      },
      include: { licenseTerms: true, rightsHolder: true },
    });
  }

  async attachPoster(itemId: string, file: Express.Multer.File) {
    if (!file?.filename) {
      throw new BadRequestException('Файл не сохранён');
    }
    if (!/^image\/(jpeg|png|gif|webp)$/i.test(file.mimetype)) {
      throw new BadRequestException(
        'Допустимы только изображения JPEG, PNG, GIF, WebP',
      );
    }
    const row = await this.prisma.catalogItem.findUnique({
      where: { id: itemId },
      select: { id: true, posterFileName: true },
    });
    if (!row) throw new NotFoundException();

    const root = uploadRoot();
    const dir = path.join(root, 'catalog', itemId);
    const newPath = path.join(dir, file.filename);

    if (row.posterFileName && row.posterFileName !== file.filename) {
      const oldPath = path.join(dir, row.posterFileName);
      if (existsSync(oldPath)) {
        await unlink(oldPath).catch(() => {});
      }
    }

    if (!existsSync(newPath)) {
      throw new BadRequestException('Файл постера не найден на диске');
    }

    await this.prisma.catalogItem.update({
      where: { id: itemId },
      data: { posterFileName: file.filename },
    });

    return this.findOne(itemId);
  }

  async getPosterFile(itemId: string): Promise<StreamableFile> {
    const row = await this.prisma.catalogItem.findUnique({
      where: { id: itemId },
      select: { posterFileName: true },
    });
    if (!row?.posterFileName) throw new NotFoundException();

    const abs = path.join(uploadRoot(), 'catalog', itemId, row.posterFileName);
    if (!existsSync(abs)) throw new NotFoundException();

    const stream = createReadStream(abs);
    return new StreamableFile(stream, {
      type: posterMimeFromName(row.posterFileName),
      disposition: 'inline',
    });
  }

  /** Безвозвратное удаление: только статус archived; вызывать после проверки admin-email. */
  async removeCatalogItem(id: string) {
    const row = await this.prisma.catalogItem.findUnique({ where: { id } });
    if (!row) throw new NotFoundException();
    if (row.status !== CatalogItemStatus.archived) {
      throw new BadRequestException(
        'Удалить можно только единицу в статусе «Архив»',
      );
    }
    await this.prisma.catalogItem.delete({ where: { id } });
    const dir = path.join(uploadRoot(), 'catalog', id);
    await rm(dir, { recursive: true, force: true }).catch(() => {});
    return { ok: true, id };
  }
}
