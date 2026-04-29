import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { createReadStream, mkdirSync, unlinkSync } from 'fs';
import { writeFile } from 'fs/promises';
import * as path from 'path';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateManualCommercialOfferDto,
  ManualOfferStatusDto,
} from './dto/create-manual-commercial-offer.dto';
import {
  CreateCommercialOfferDto,
  OfferTemplateKindDto,
} from './dto/create-commercial-offer.dto';
import {
  type OfferTemplateVariant,
  renderOfferPdfFromDto,
} from './offer-template.engine';

function uploadRoot(): string {
  return process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'uploads');
}

@Injectable()
export class CommercialOffersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(filters?: { archivedOnly?: boolean; signedOnly?: boolean }) {
    const archivedOnly = filters?.archivedOnly === true;
    const signedOnly = filters?.signedOnly === true;

    const where: Prisma.CommercialOfferWhereInput = {};
    if (signedOnly) {
      where.clientSigned = true;
      where.archived = false;
    } else if (archivedOnly) {
      where.archived = true;
    } else {
      where.archived = false;
      where.clientSigned = false;
    }

    return this.prisma.commercialOffer
      .findMany({
        where,
        orderBy: signedOnly
          ? [{ signedAt: 'desc' }, { createdAt: 'desc' }]
          : { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          storageKey: true,
          archived: true,
          clientSigned: true,
          signedAt: true,
          sourceOfferId: true,
          createdAt: true,
          updatedAt: true,
          payload: true,
        },
      })
      .then((rows) =>
        rows.map((row) => {
          const p = row.payload as Record<string, unknown> | null;
          const clientLegalName =
            typeof p?.clientLegalName === 'string'
              ? p.clientLegalName
              : undefined;
          const templateKindRaw = p?.templateKind;
          const templateKind =
            templateKindRaw === OfferTemplateKindDto.platforms
              ? OfferTemplateKindDto.platforms
              : templateKindRaw === OfferTemplateKindDto.platforms_package
                ? OfferTemplateKindDto.platforms_package
                : OfferTemplateKindDto.po;
          const manualStatusRaw = p?.manualStatus;
          const manualStatus =
            manualStatusRaw === ManualOfferStatusDto.agreed
              ? ManualOfferStatusDto.agreed
              : manualStatusRaw === ManualOfferStatusDto.on_review
                ? ManualOfferStatusDto.on_review
                : undefined;
          const dealId = typeof p?.dealId === 'string' ? p.dealId : undefined;
          const dealTitle = typeof p?.dealTitle === 'string' ? p.dealTitle : undefined;
          return {
            id: row.id,
            title: row.title,
            storageKey: row.storageKey,
            archived: row.archived,
            clientSigned: row.clientSigned,
            signedAt: row.signedAt,
            sourceOfferId: row.sourceOfferId,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
            clientLegalName,
            templateKind,
            dealId,
            dealTitle,
            manualStatus,
          };
        }),
      );
  }

  async setArchived(id: string, archived: boolean) {
    const row = await this.prisma.commercialOffer.update({
      where: { id },
      data: { archived },
      select: {
        id: true,
        title: true,
        archived: true,
        updatedAt: true,
      },
    });
    return row;
  }

  /** Безвозвратное удаление: только архивный оффер; после проверки admin-email. */
  async remove(id: string) {
    const row = await this.prisma.commercialOffer.findUnique({ where: { id } });
    if (!row) throw new NotFoundException();
    if (!row.archived) {
      throw new BadRequestException('Удалить можно только оффер из архива');
    }
    const abs = path.join(uploadRoot(), row.storageKey);
    await this.prisma.commercialOffer.delete({ where: { id } });
    try {
      unlinkSync(abs);
    } catch {
      /* ignore */
    }
    return { ok: true, id };
  }

  private async assertBuyerOrgHasDeals(
    buyerOrgId: string,
  ): Promise<{ legalName: string }> {
    const deal = await this.prisma.deal.findFirst({
      where: { buyerOrgId, archived: false },
      include: { buyer: true },
    });
    if (!deal?.buyer) {
      throw new BadRequestException(
        'Клиент не найден или по нему нет ни одной сделки',
      );
    }
    return { legalName: deal.buyer.legalName };
  }

  async create(dto: CreateCommercialOfferDto) {
    const { legalName: clientLegalName } = await this.assertBuyerOrgHasDeals(
      dto.buyerOrgId,
    );
    const variant: OfferTemplateVariant =
      dto.templateKind === OfferTemplateKindDto.platforms_package
        ? 'platforms_package'
        : dto.templateKind === OfferTemplateKindDto.platforms
          ? 'platforms'
          : 'po';
    const templateKindStored =
      variant === 'platforms_package'
        ? OfferTemplateKindDto.platforms_package
        : variant === 'platforms'
          ? OfferTemplateKindDto.platforms
          : OfferTemplateKindDto.po;
    const payloadForStore = {
      ...dto,
      clientLegalName,
      templateKind: templateKindStored,
    };
    let buf: Buffer;
    try {
      buf = await renderOfferPdfFromDto(dto, variant, clientLegalName);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new ServiceUnavailableException(
        `Не удалось сформировать PDF оффера. ${msg}`,
      );
    }
    const id = randomUUID();
    const storageKey = path.join('commercial-offers', `${id}.pdf`);
    const abs = path.join(uploadRoot(), storageKey);
    mkdirSync(path.dirname(abs), { recursive: true });
    await writeFile(abs, buf);
    const row = await this.prisma.commercialOffer.create({
      data: {
        id,
        title: dto.workTitle,
        payload: JSON.parse(
          JSON.stringify(payloadForStore),
        ) as Prisma.InputJsonValue,
        storageKey,
        clientSigned: false,
      },
    });
    return {
      id: row.id,
      title: row.title,
      storageKey,
      createdAt: row.createdAt,
    };
  }

  async createManual(
    dto: CreateManualCommercialOfferDto,
    file: Express.Multer.File | undefined,
  ) {
    if (!file) throw new BadRequestException('Файл оффера обязателен');
    const deal = await this.prisma.deal.findUnique({
      where: { id: dto.dealId },
      include: { buyer: true },
    });
    if (!deal) throw new BadRequestException('Сделка не найдена');
    const id = randomUUID();
    const ext = path.extname(file.originalname || '').toLowerCase();
    const storageKey = path.join('commercial-offers', 'manual', `${id}${ext}`);
    const abs = path.join(uploadRoot(), storageKey);
    mkdirSync(path.dirname(abs), { recursive: true });
    await writeFile(abs, file.buffer);
    const payloadForStore = {
      manual: true,
      dealId: deal.id,
      dealTitle: deal.title,
      clientLegalName: deal.buyer?.legalName ?? '',
      templateKind: dto.templateKind,
      manualStatus: dto.status,
      originalName: file.originalname,
      mimeType: file.mimetype,
      uploadedAt: new Date().toISOString(),
    };
    const row = await this.prisma.commercialOffer.create({
      data: {
        id,
        title: `Ручной оффер: ${deal.title}`,
        payload: JSON.parse(
          JSON.stringify(payloadForStore),
        ) as Prisma.InputJsonValue,
        storageKey,
        clientSigned: false,
      },
    });
    return {
      id: row.id,
      title: row.title,
      storageKey,
      createdAt: row.createdAt,
    };
  }

  async getDocumentStream(id: string): Promise<{
    stream: ReturnType<typeof createReadStream>;
    fileName: string;
  } | null> {
    const row = await this.prisma.commercialOffer.findUnique({
      where: { id },
    });
    if (!row?.storageKey) return null;
    const abs = path.join(uploadRoot(), row.storageKey);
    const stream = createReadStream(abs);
    const safe =
      row.title
        .replace(/[^\w\u0400-\u04FF\s-]+/g, '')
        .trim()
        .slice(0, 80) || 'offer';
    return {
      stream,
      fileName: `${safe}-${id.slice(0, 8)}.pdf`,
    };
  }

  async findById(id: string) {
    const row = await this.prisma.commercialOffer.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        storageKey: true,
        archived: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!row) throw new NotFoundException();
    return row;
  }
}
