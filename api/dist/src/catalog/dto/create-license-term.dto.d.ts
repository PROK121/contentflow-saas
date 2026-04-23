import { Exclusivity, Platform } from '@prisma/client';
export declare class CreateLicenseTermDto {
    territoryCode: string;
    startAt?: string;
    endAt?: string;
    durationMonths?: number;
    exclusivity: Exclusivity;
    platforms: Platform[];
    sublicensingAllowed?: boolean;
    languageRights: string[];
}
