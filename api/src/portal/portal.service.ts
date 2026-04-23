import { Injectable } from '@nestjs/common';
import { ContractStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PortalService {
  constructor(private readonly prisma: PrismaService) {}

  async rightsOwnerSummary(rightsHolderOrgId: string) {
    const contentCount = await this.prisma.catalogItem.count({
      where: { rightsHolderOrgId },
    });

    const activeLicensesCount = await this.prisma.contract.count({
      where: {
        status: ContractStatus.signed,
        termEndAt: { gt: new Date() },
        deal: {
          catalogItems: {
            some: { catalogItem: { rightsHolderOrgId } },
          },
        },
      },
    });

    const payoutSum = await this.prisma.payout.aggregate({
      where: { rightsHolderOrgId },
      _sum: { amountNet: true },
    });
    const pendingPayoutsTotal = payoutSum._sum.amountNet?.toString() ?? '0';

    const items = await this.prisma.catalogItem.findMany({
      where: { rightsHolderOrgId },
      take: 50,
      include: {
        licenseTerms: true,
        deals: {
          include: {
            deal: true,
          },
        },
      },
    });

    const portalItems = items.map((item) => ({
      catalogItemId: item.id,
      title: item.title,
      soldRegions: item.licenseTerms.map((t) => t.territoryCode),
      lastDealAmount: item.deals[0]?.deal?.commercialSnapshot
        ? String(
            (item.deals[0].deal.commercialSnapshot as { amount?: string })
              ?.amount ?? '',
          )
        : undefined,
      lastPayoutStatus: undefined as string | undefined,
    }));

    return {
      contentCount,
      activeLicensesCount,
      pendingPayoutsTotal: pending.length === 0 ? '0' : pendingPayoutsTotal,
      items: portalItems,
    };
  }
}
