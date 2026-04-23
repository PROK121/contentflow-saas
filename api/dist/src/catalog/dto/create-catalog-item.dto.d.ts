import { AssetType } from '@prisma/client';
import { CreateLicenseTermDto } from './create-license-term.dto';
export declare class CreateCatalogItemDto {
    title: string;
    slug: string;
    assetType: AssetType;
    rightsHolderOrgId: string;
    metadata?: Record<string, unknown>;
    licenseTerms: CreateLicenseTermDto[];
}
