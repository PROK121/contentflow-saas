import { CatalogItemStatus } from '@prisma/client';
import { CreateLicenseTermDto } from './create-license-term.dto';
export declare class UpdateCatalogItemDto {
    title?: string;
    status?: CatalogItemStatus;
    metadataPatch?: Record<string, unknown>;
    licenseTerms?: CreateLicenseTermDto[];
}
