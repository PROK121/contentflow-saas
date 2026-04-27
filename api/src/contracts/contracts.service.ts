import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ContractStatus,
  Prisma,
  TaskPriority,
  TaskStatus,
  TaskType,
} from '@prisma/client';
import { createHash } from 'crypto';
import { createReadStream, createWriteStream, existsSync } from 'fs';
import { mkdir } from 'fs/promises';
import * as path from 'path';
import PDFDocument = require('pdfkit');
import { PrismaService } from '../prisma/prisma.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { Decimal } from '@prisma/client/runtime/library';

function contractsUploadRoot(): string {
  return process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'uploads');
}

const DEFAULT_TEMPLATE_ID = 'default-template';

@Injectable()
export class ContractsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(filters?: {
    q?: string;
    take?: number;
    archivedOnly?: boolean;
    signedOnly?: boolean;
  }) {
    const where: Prisma.ContractWhereInput = {};
    const signedOnly = filters?.signedOnly === true;
    const archivedOnly = filters?.archivedOnly === true;
    if (signedOnly) {
      where.clientCabinetSigned = true;
      where.archived = false;
    } else if (archivedOnly) {
      where.archived = true;
    } else {
      where.archived = false;
      where.clientCabinetSigned = false;
    }
    if (filters?.q?.trim()) {
      const q = filters.q.trim();
      where.OR = [
        { number: { contains: q, mode: 'insensitive' } },
        { deal: { title: { contains: q, mode: 'insensitive' } } },
        {
          deal: {
            buyer: { legalName: { contains: q, mode: 'insensitive' } },
          },
        },
      ];
    }
    const take =
      filters?.take != null
        ? Math.min(200, Math.max(1, Math.floor(filters.take)))
        : undefined;
    return this.prisma.contract.findMany({
      where,
      ...(take != null ? { take } : {}),
      orderBy: signedOnly
        ? [{ cabinetSignedAt: 'desc' }, { updatedAt: 'desc' }]
        : { updatedAt: 'desc' },
      include: {
        deal: { include: { buyer: { select: { id: true, legalName: true } } } },
      },
    });
  }

  async updateArchived(id: string, archived: boolean) {
    const exists = await this.prisma.contract.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException();
    return this.prisma.contract.update({
      where: { id },
      data: { archived },
      include: {
        deal: { include: { buyer: { select: { id: true, legalName: true } } } },
      },
    });
  }

  findById(id: string) {
    return this.prisma.contract.findUnique({
      where: { id },
      include: {
        deal: {
          include: {
            buyer: true,
            catalogItems: { include: { catalogItem: true } },
          },
        },
      },
    });
  }

  /**
   * Отдаёт файл версии; если на диске нет — создаёт PDF-заглушку (dev/MVP).
   */
  async getVersionFileForDownload(contractId: string, versionNum: number) {
    if (!Number.isInteger(versionNum) || versionNum < 1) {
      throw new NotFoundException('Invalid version');
    }
    const ver = await this.prisma.contractVersion.findFirst({
      where: { contractId, version: versionNum },
    });
    if (!ver) throw new NotFoundException('Version not found');
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      select: { id: true, number: true },
    });
    if (!contract) throw new NotFoundException();

    const abs = path.join(contractsUploadRoot(), ver.storageKey);
    const dir = path.dirname(abs);
    await mkdir(dir, { recursive: true });
    if (!existsSync(abs)) {
      await this.writeContractPlaceholderPdf(abs, contract.number, versionNum);
    }

    const stream = createReadStream(abs);
    const safeNum = contract.number.replace(/[/\\?%*:|"<>]/g, '_').slice(0, 80);
    const fileName = `${safeNum}-v${versionNum}.pdf`;
    return { stream, fileName };
  }

  private writeContractPlaceholderPdf(
    absPath: string,
    contractNumber: string,
    version: number,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const w = createWriteStream(absPath);
      doc.pipe(w);
      doc.fontSize(18).text(`Контракт ${contractNumber}`, { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`Версия документа: ${version}`, { align: 'left' });
      doc.moveDown(0.5);
      doc
        .fontSize(10)
        .text(
          'Авто-сгенерированный PDF. При работе с реальными файлами замените документ в хранилище (storageKey).',
          { align: 'left' },
        );
      doc.end();
      w.on('finish', () => resolve());
      w.on('error', reject);
    });
  }

  private buildDealSnapshotFingerprint(deal: {
    title: string;
    buyerOrgId: string;
    currency: string;
    commercialSnapshot: Prisma.JsonValue | null;
    catalogItems: {
      catalogItemId: string;
      rightsSelection: Prisma.JsonValue | null;
    }[];
  }): string {
    const payload = JSON.stringify({
      title: deal.title,
      buyerOrgId: deal.buyerOrgId,
      currency: deal.currency,
      commercialSnapshot: deal.commercialSnapshot,
      lines: deal.catalogItems.map((l) => ({
        catalogItemId: l.catalogItemId,
        rights: l.rightsSelection,
      })),
    });
    return createHash('sha256').update(payload).digest('hex').slice(0, 40);
  }

  async createDraft(dto: CreateContractDto) {
    const isPlatformTemplate =
      typeof dto.templateId === 'string' &&
      dto.templateId.startsWith('contract-platform:');
    const rawDealIds = [dto.dealId, ...(dto.dealIds ?? [])].filter(Boolean);
    const dedupedDealIds = [...new Set(rawDealIds)];
    const dealIds = isPlatformTemplate ? dedupedDealIds : [dto.dealId];

    const deals = await this.prisma.deal.findMany({
      where: { id: { in: dealIds } },
      include: { catalogItems: true },
    });
    if (deals.length === 0) throw new NotFoundException('Deal not found');
    if (deals.length !== dealIds.length) {
      throw new NotFoundException('One or more deals not found');
    }
    const primaryDeal = deals.find((d) => d.id === dto.dealId) ?? deals[0];
    if (!primaryDeal) throw new NotFoundException('Deal not found');

    if (isPlatformTemplate && deals.length > 1) {
      const buyerOrgId = primaryDeal.buyerOrgId;
      const currency = primaryDeal.currency;
      const hasMismatch = deals.some(
        (d) => d.buyerOrgId !== buyerOrgId || d.currency !== currency,
      );
      if (hasMismatch) {
        throw new BadRequestException(
          'Для контракта с площадкой выберите сделки одного контрагента и одной валюты',
        );
      }
    }

    const templateId = dto.templateId ?? DEFAULT_TEMPLATE_ID;
    const amountTotal = deals.reduce((sum, d) => {
      const snap = (d.commercialSnapshot as Record<string, unknown> | null) ?? {};
      const ev = snap.expectedValue;
      const raw =
        typeof ev === 'string' || typeof ev === 'number' ? String(ev) : '0';
      const parsed = Number.parseFloat(raw.replace(/\s/g, '').replace(',', '.'));
      return sum + (Number.isFinite(parsed) ? parsed : 0);
    }, 0);

    const termEnd = new Date();
    termEnd.setFullYear(termEnd.getFullYear() + 1);

    const rightsPayload: Prisma.InputJsonValue = {
      dealId: primaryDeal.id,
      dealIds,
      catalogLines: deals.flatMap((d) =>
        d.catalogItems.map((l) => ({
          dealId: d.id,
          catalogItemId: l.catalogItemId,
          rightsSelection: l.rightsSelection,
        })),
      ),
      templateId,
    };

    const fingerprint = this.buildDealSnapshotFingerprint({
      title: isPlatformTemplate
        ? deals.map((d) => d.title).sort().join(' | ')
        : primaryDeal.title,
      buyerOrgId: primaryDeal.buyerOrgId,
      currency: primaryDeal.currency,
      commercialSnapshot: isPlatformTemplate
        ? ({ deals: deals.map((d) => d.commercialSnapshot) } as Prisma.JsonValue)
        : primaryDeal.commercialSnapshot,
      catalogItems: deals.flatMap((d) => d.catalogItems),
    });

    const number = `CF-${Date.now()}`;
    const contract = await this.prisma.contract.create({
      data: {
        dealId: primaryDeal.id,
        number,
        status: ContractStatus.draft,
        territory: 'MULTI',
        termEndAt: termEnd,
        amount: new Decimal(String(amountTotal || 0)),
        currency: primaryDeal.currency,
        rightsPayload,
        templateId,
        dealSnapshotFingerprint: fingerprint,
        clientCabinetSigned: false,
      },
      include: { deal: true },
    });

    await this.prisma.contractVersion.create({
      data: {
        contractId: contract.id,
        version: 1,
        storageKey: `contracts/${contract.id}/v1.pdf`,
        sha256: createHash('sha256')
          .update(`draft-${contract.id}-v1`)
          .digest('hex'),
        templateId,
      },
    });

    return contract;
  }

  async markSent(contractId: string, signingDueAt?: string) {
    const c = await this.prisma.contract.findUnique({
      where: { id: contractId },
      include: { deal: true },
    });
    if (!c) throw new NotFoundException();
    const due = signingDueAt ? new Date(signingDueAt) : undefined;
    const updated = await this.prisma.contract.update({
      where: { id: contractId },
      data: {
        status: ContractStatus.sent,
        signingDueAt: due ?? c.signingDueAt,
      },
    });
    await this.prisma.task.create({
      data: {
        assigneeId: c.deal.ownerUserId,
        dueAt: due ?? new Date(Date.now() + 7 * 86400000),
        type: TaskType.custom,
        status: TaskStatus.todo,
        priority: TaskPriority.high,
        linkedEntityType: 'contract',
        linkedEntityId: contractId,
        title: 'Напоминание: контракт не подписан клиентом',
      },
    });
    return updated;
  }

  async markSigned(contractId: string) {
    const c = await this.prisma.contract.findUnique({
      where: { id: contractId },
    });
    if (!c) throw new NotFoundException();
    const updated = await this.prisma.contract.update({
      where: { id: contractId },
      data: { status: ContractStatus.signed },
    });
    await this.prisma.task.updateMany({
      where: {
        linkedEntityType: 'contract',
        linkedEntityId: contractId,
        title: 'Напоминание: контракт не подписан клиентом',
        status: { not: TaskStatus.done },
      },
      data: { status: TaskStatus.done },
    });
    return updated;
  }

  /// Click-sign правообладателем из кабинета /holder/contracts/:id.
  ///
  /// Бизнес-правила:
  /// 1. Контракт должен принадлежать организации правообладателя
  ///    (проверяется выше — в HolderController через scope.findContractOrFail).
  /// 2. Текущий статус должен быть `sent` (менеджер выпустил договор и
  ///    отправил его на подписание). Подписать `draft` нельзя — он не имеет
  ///    стабильной редакции; подписать `signed`/`expired`/`terminated`
  ///    повторно тоже нельзя.
  /// 3. Должна существовать хотя бы одна `ContractVersion`
  ///    (PDF, который, собственно, подписывают).
  /// 4. Фиксируем «слепок» документа: версия + sha256.
  ///    Если потом контент перегенерируют — поле `holderSignedHash`
  ///    не совпадёт с `ContractVersion.sha256` и видно, что подпись больше
  ///    не действительна (выводим в UI).
  async signByHolder(input: {
    contractId: string;
    userId: string;
    organizationId: string;
    ip?: string;
    userAgent?: string;
    termsVersion: string;
  }): Promise<{ contractId: string; version: number; sha256: string }> {
    // Фильтр идентичен HolderScopeService.findContractOrFail —
    // организация-правообладатель привязана к контракту через
    // RoyaltyLine.rightsHolderOrgId (одна или несколько линий выплат).
    const c = await this.prisma.contract.findFirst({
      where: {
        id: input.contractId,
        royaltyLines: { some: { rightsHolderOrgId: input.organizationId } },
      },
    });
    if (!c) throw new NotFoundException('Contract not found');

    if (c.holderSignedAt) {
      throw new ConflictException('Контракт уже подписан');
    }

    if (c.status !== ContractStatus.sent) {
      throw new BadRequestException(
        'Подписание доступно только когда менеджер отправил контракт',
      );
    }

    const lastVersion = await this.prisma.contractVersion.findFirst({
      where: { contractId: input.contractId },
      orderBy: { version: 'desc' },
      select: { id: true, version: true, sha256: true },
    });
    if (!lastVersion) {
      throw new BadRequestException(
        'У контракта нет версии PDF — обратитесь к менеджеру',
      );
    }

    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.contract.update({
        where: { id: input.contractId },
        data: {
          status: ContractStatus.signed,
          holderSignedByUserId: input.userId,
          holderSignedAt: now,
          holderSignedIp: input.ip,
          holderSignedUserAgent: input.userAgent?.slice(0, 1024),
          holderSignedVersion: lastVersion.version,
          holderSignedHash: lastVersion.sha256,
          holderSignedTermsVer: input.termsVersion,
        },
      }),
      this.prisma.contractVersion.update({
        where: { id: lastVersion.id },
        data: { signedAt: now },
      }),
      // Любые открытые напоминания «контракт не подписан» закрываем —
      // больше они не актуальны.
      this.prisma.task.updateMany({
        where: {
          linkedEntityType: 'contract',
          linkedEntityId: input.contractId,
          status: { not: TaskStatus.done },
        },
        data: { status: TaskStatus.done },
      }),
    ]);

    return {
      contractId: input.contractId,
      version: lastVersion.version,
      sha256: lastVersion.sha256,
    };
  }

  async markExpiredDraft(contractId: string) {
    const c = await this.prisma.contract.findUnique({
      where: { id: contractId },
    });
    if (!c) throw new NotFoundException();
    return this.prisma.contract.update({
      where: { id: contractId },
      data: { status: ContractStatus.expired },
    });
  }

  async compareWithDeal(contractId: string) {
    const c = await this.findById(contractId);
    if (!c) throw new NotFoundException();
    const deal = c.deal;
    if (!deal) throw new NotFoundException();

    const currentFp = this.buildDealSnapshotFingerprint({
      title: deal.title,
      buyerOrgId: deal.buyerOrgId,
      currency: deal.currency,
      commercialSnapshot: deal.commercialSnapshot,
      catalogItems: deal.catalogItems,
    });
    const fingerprintDiffers =
      !!c.dealSnapshotFingerprint && c.dealSnapshotFingerprint !== currentFp;

    const differences: string[] = [];
    const snap =
      (deal.commercialSnapshot as Record<string, unknown> | null) ?? {};
    const ev = snap.expectedValue;
    const evRaw =
      ev !== undefined && ev !== null && String(ev).trim() !== ''
        ? String(ev)
        : null;
    const contractAmtStr = new Decimal(c.amount).toFixed(2);
    if (evRaw !== null) {
      const a = parseFloat(String(evRaw).replace(/\s/g, '').replace(',', '.'));
      const b = parseFloat(contractAmtStr);
      if (!Number.isNaN(a) && !Number.isNaN(b) && Math.abs(a - b) > 0.01) {
        differences.push(
          `Сумма: в сделке ожидается ${evRaw} ${deal.currency}, в контракте ${contractAmtStr} ${c.currency}`,
        );
      }
    }
    if (deal.currency !== c.currency) {
      differences.push(
        `Валюта: сделка ${deal.currency}, контракт ${c.currency}`,
      );
    }

    const sortLines = (
      rows: {
        catalogItemId: string;
        rightsSelection: Prisma.JsonValue | null;
      }[],
    ) =>
      JSON.stringify(
        [...rows]
          .map((r) => ({
            catalogItemId: r.catalogItemId,
            rightsSelection: r.rightsSelection,
          }))
          .sort((x, y) => x.catalogItemId.localeCompare(y.catalogItemId)),
      );

    const dealSorted = sortLines(deal.catalogItems);
    const payload = c.rightsPayload as { catalogLines?: unknown[] } | null;
    const rawLines = Array.isArray(payload?.catalogLines)
      ? payload.catalogLines
      : [];
    const contractRows = rawLines.map((line: unknown) => {
      const l = line as {
        catalogItemId?: string;
        rightsSelection?: Prisma.JsonValue | null;
      };
      return {
        catalogItemId: l.catalogItemId ?? '',
        rightsSelection: l.rightsSelection ?? null,
      };
    });
    const contractSorted = JSON.stringify(
      [...contractRows].sort((x, y) =>
        x.catalogItemId.localeCompare(y.catalogItemId),
      ),
    );
    if (dealSorted !== contractSorted) {
      differences.push(
        'Состав контента или параметры прав в сделке не совпадают со снимком в контракте',
      );
    }

    const differs = fingerprintDiffers || differences.length > 0;
    return {
      differs,
      differences,
      contractFingerprint: c.dealSnapshotFingerprint,
      dealFingerprint: currentFp,
      message: differs
        ? differences.length > 0
          ? 'Обнаружены расхождения между сделкой и контрактом'
          : 'Данные сделки изменились после генерации контракта'
        : 'Данные сделки совпадают со снимком контракта',
    };
  }

  async addManualVersion(contractId: string, note?: string) {
    const c = await this.prisma.contract.findUnique({
      where: { id: contractId },
    });
    if (!c) throw new NotFoundException();
    const last = await this.prisma.contractVersion.findFirst({
      where: { contractId },
      orderBy: { version: 'desc' },
    });
    const nextV = (last?.version ?? 0) + 1;
    const templateId = c.templateId ?? DEFAULT_TEMPLATE_ID;
    const v = await this.prisma.contractVersion.create({
      data: {
        contractId,
        version: nextV,
        storageKey: `contracts/${contractId}/v${nextV}-manual.pdf`,
        sha256: createHash('sha256')
          .update(`manual-${contractId}-v${nextV}-${note ?? ''}`)
          .digest('hex'),
        templateId,
      },
    });
    return { version: v, note: note ?? 'Manual edit saved as new version' };
  }

  versions(contractId: string) {
    return this.prisma.contractVersion.findMany({
      where: { contractId },
      orderBy: { version: 'desc' },
    });
  }

  /// Возвращает номер последней версии контракта или null, если версий ещё нет.
  /// Используется кабинетом правообладателя для скачивания «текущего» документа.
  async latestVersionNumber(contractId: string): Promise<number | null> {
    const last = await this.prisma.contractVersion.findFirst({
      where: { contractId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    return last?.version ?? null;
  }

  /** Безвозвратное удаление: только архивный контракт; после проверки admin-email. */
  async removeContract(contractId: string) {
    const c = await this.prisma.contract.findUnique({
      where: { id: contractId },
    });
    if (!c) throw new NotFoundException();
    if (!c.archived) {
      throw new BadRequestException('Удалить можно только архивный контракт');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.task.deleteMany({
        where: {
          linkedEntityType: 'contract',
          linkedEntityId: contractId,
        },
      });
      await tx.payout.deleteMany({ where: { contractId } });
      await tx.royaltyLine.deleteMany({ where: { contractId } });
      await tx.contractVersion.deleteMany({ where: { contractId } });
      await tx.payment.deleteMany({ where: { contractId } });
      await tx.contract.delete({ where: { id: contractId } });
    });
    return { ok: true, id: contractId };
  }
}
