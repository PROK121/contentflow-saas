import { PortalService } from './portal.service';
export declare class PortalController {
    private readonly portalService;
    constructor(portalService: PortalService);
    summary(orgId?: string): Promise<{
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
