import { Exclusivity, Platform } from '@prisma/client';
export declare class RightsSelectionItemDto {
    catalogItemId: string;
    territoryCodes: string[];
    startAt?: string;
    endAt?: string;
    platforms: Platform[];
    exclusivity: Exclusivity;
}
export declare class SoldHintsDto {
    catalogItemIds: string[];
}
export declare class ValidateRightsDto {
    catalogItemId: string;
    selection: RightsSelectionItemDto;
    excludeDealId?: string;
    adminOverride?: boolean;
}
