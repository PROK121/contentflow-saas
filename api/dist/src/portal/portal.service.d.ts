import { PrismaService } from '../prisma/prisma.service';
export declare class PortalService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    rightsOwnerSummary(rightsHolderOrgId: string): Promise<{
        contentCount: number;
        activeLicensesCount: number;
        pendingPayoutsTotal: string;
        items: {
            catalogItemId: string;
            title: string;
            soldRegions: string[];
            lastDealAmount: string | undefined;
            lastPayoutStatus: string | undefined;
        }[];
    }>;
}
