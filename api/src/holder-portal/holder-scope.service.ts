import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { HolderFinanceVisibility } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/// Все запросы данных в кабинете правообладателя проходят через этот сервис.
/// Его задача — гарантировать, что любой запрос ограничен организацией текущего
/// пользователя. Контроллеры НЕ должны напрямую дёргать Prisma — только через
/// scope-хелперы, чтобы не забыть фильтр.
///
/// В дополнение к scope-фильтру сервис учитывает уровень видимости финансов
/// `Organization.holderFinanceVisibility`:
///   • `limited` (по умолчанию) — суммы скрыты, отдаётся лишь сам факт выплаты,
///     валюта, статус.
///   • `full` — суммы и FX отдаются полностью.
@Injectable()
export class HolderScopeService {
  constructor(private readonly prisma: PrismaService) {}

  /// Эффективный уровень видимости финансов для конкретного представителя:
  /// `User.holderFinanceOverride` либо, если не задан, уровень организации.
  async getEffectiveFinanceVisibility(
    userId: string,
    orgId: string,
  ): Promise<HolderFinanceVisibility> {
    const [org, user] = await Promise.all([
      this.prisma.organization.findUnique({
        where: { id: orgId },
        select: { holderFinanceVisibility: true },
      }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { organizationId: true, holderFinanceOverride: true },
      }),
    ]);
    if (user?.organizationId !== orgId) {
      return org?.holderFinanceVisibility ?? HolderFinanceVisibility.limited;
    }
    return (
      user.holderFinanceOverride ??
      org?.holderFinanceVisibility ??
      HolderFinanceVisibility.limited
    );
  }

  // ==========================================================================
  // CATALOG ITEMS — тайтлы, у которых rightsHolderOrgId == orgId
  // ==========================================================================

  async listCatalogItems(orgId: string) {
    return this.prisma.catalogItem.findMany({
      where: { rightsHolderOrgId: orgId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        slug: true,
        assetType: true,
        status: true,
        posterFileName: true,
        metadata: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /// Один тайтл — с проверкой принадлежности.
  async findCatalogItemOrFail(orgId: string, id: string) {
    const item = await this.prisma.catalogItem.findFirst({
      where: { id, rightsHolderOrgId: orgId },
      include: {
        licenseTerms: true,
      },
    });
    if (!item) throw new NotFoundException('Тайтл не найден');
    return item;
  }

  // ==========================================================================
  // DEALS — сделки, в которых хотя бы один тайтл принадлежит правообладателю.
  // Возвращаем ОБРЕЗАННУЮ форму: без commercialSnapshot и без owner manager.
  // ==========================================================================

  async listDeals(orgId: string) {
    const deals = await this.prisma.deal.findMany({
      where: {
        archived: false,
        catalogItems: {
          some: { catalogItem: { rightsHolderOrgId: orgId } },
        },
      },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        kind: true,
        stage: true,
        currency: true,
        expectedCloseAt: true,
        actualCloseAt: true,
        createdAt: true,
        updatedAt: true,
        buyer: { select: { id: true, legalName: true, country: true } },
        catalogItems: {
          where: { catalogItem: { rightsHolderOrgId: orgId } },
          select: {
            rightsSelection: true,
            catalogItem: {
              select: { id: true, title: true, slug: true, assetType: true },
            },
          },
        },
      },
    });
    return deals;
  }

  async findDealOrFail(orgId: string, id: string) {
    const deal = await this.prisma.deal.findFirst({
      where: {
        id,
        catalogItems: {
          some: { catalogItem: { rightsHolderOrgId: orgId } },
        },
      },
      select: {
        id: true,
        title: true,
        kind: true,
        stage: true,
        currency: true,
        expectedCloseAt: true,
        actualCloseAt: true,
        archived: true,
        createdAt: true,
        updatedAt: true,
        buyer: { select: { id: true, legalName: true, country: true } },
        catalogItems: {
          where: { catalogItem: { rightsHolderOrgId: orgId } },
          select: {
            rightsSelection: true,
            catalogItem: {
              select: { id: true, title: true, slug: true, assetType: true },
            },
          },
        },
      },
    });
    if (!deal) throw new NotFoundException('Сделка не найдена');
    return deal;
  }

  // ==========================================================================
  // PAYOUTS — выплаты строго по rightsHolderOrgId
  // ==========================================================================

  async listPayouts(orgId: string, viewerUserId: string) {
    const visibility = await this.getEffectiveFinanceVisibility(
      viewerUserId,
      orgId,
    );

    const rows = await this.prisma.payout.findMany({
      where: { rightsHolderOrgId: orgId },
      orderBy: { createdAt: 'desc' },
      include: {
        contract: {
          select: { id: true, number: true, deal: { select: { id: true, title: true } } },
        },
      },
    });

    if (visibility === HolderFinanceVisibility.full) {
      return { items: rows, financeVisibility: visibility };
    }

    // limited: возвращаем только мета-поля, без сумм/FX/налогов.
    return {
      items: rows.map((p) => ({
        id: p.id,
        currency: p.currency,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        contract: p.contract,
      })),
      financeVisibility: visibility,
    };
  }

  // ==========================================================================
  // CONTRACTS — контракты, у которых RoyaltyLine.rightsHolderOrgId == orgId
  // ==========================================================================

  async listContracts(orgId: string) {
    return this.prisma.contract.findMany({
      where: {
        archived: false,
        royaltyLines: { some: { rightsHolderOrgId: orgId } },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        number: true,
        status: true,
        territory: true,
        termEndAt: true,
        currency: true,
        signingDueAt: true,
        cabinetSignedAt: true,
        clientCabinetSigned: true,
        holderSignedAt: true,
        holderSignedVersion: true,
        createdAt: true,
        deal: { select: { id: true, title: true } },
      },
    });
  }

  async findContractOrFail(orgId: string, id: string) {
    const contract = await this.prisma.contract.findFirst({
      where: {
        id,
        royaltyLines: { some: { rightsHolderOrgId: orgId } },
      },
    });
    if (!contract) {
      throw new ForbiddenException('Контракт недоступен этой организации');
    }
    return contract;
  }

  // ==========================================================================
  // DASHBOARD — агрегаты для главной кабинета
  // ==========================================================================

  async dashboardCounters(orgId: string, viewerUserId: string) {
    const visibility = await this.getEffectiveFinanceVisibility(
      viewerUserId,
      orgId,
    );
    const [
      titlesCount,
      activeDealsCount,
      pendingContractsCount,
      payoutsCount,
      pendingPayoutsAgg,
      lastPayoutDate,
    ] = await Promise.all([
      this.prisma.catalogItem.count({
        where: { rightsHolderOrgId: orgId },
      }),
      this.prisma.deal.count({
        where: {
          archived: false,
          stage: { in: ['lead', 'negotiation', 'contract'] },
          catalogItems: {
            some: { catalogItem: { rightsHolderOrgId: orgId } },
          },
        },
      }),
      this.prisma.contract.count({
        where: {
          archived: false,
          status: { in: ['draft', 'sent'] },
          royaltyLines: { some: { rightsHolderOrgId: orgId } },
        },
      }),
      this.prisma.payout.count({
        where: { rightsHolderOrgId: orgId },
      }),
      this.prisma.payout.aggregate({
        where: { rightsHolderOrgId: orgId },
        _sum: { amountNet: true },
      }),
      this.prisma.payout.findFirst({
        where: { rightsHolderOrgId: orgId },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true, amountNet: true, currency: true },
      }),
    ]);

    if (visibility === HolderFinanceVisibility.full) {
      return {
        financeVisibility: visibility,
        titlesCount,
        activeDealsCount,
        pendingContractsCount,
        payoutsCount,
        payoutsTotal: pendingPayoutsAgg._sum.amountNet?.toString() ?? '0',
        lastPayout: lastPayoutDate
          ? {
              at: lastPayoutDate.createdAt,
              amount: lastPayoutDate.amountNet.toString(),
              currency: lastPayoutDate.currency,
            }
          : null,
      };
    }

    return {
      financeVisibility: visibility,
      titlesCount,
      activeDealsCount,
      pendingContractsCount,
      payoutsCount,
      payoutsTotal: null,
      lastPayout: lastPayoutDate
        ? { at: lastPayoutDate.createdAt, currency: lastPayoutDate.currency }
        : null,
    };
  }
}
