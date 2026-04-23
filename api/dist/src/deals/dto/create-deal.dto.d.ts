import { DealKind } from '@prisma/client';
import { RightsSelectionItemDto } from './rights-selection-item.dto';
export declare class CreateDealDto {
    title: string;
    kind?: DealKind;
    buyerOrgId: string;
    ownerUserId: string;
    currency: string;
    catalogItemIds?: string[];
    commercialExpectedValue?: string;
    vatIncluded?: boolean;
    rightsSelections?: RightsSelectionItemDto[];
    adminOverride?: boolean;
}
