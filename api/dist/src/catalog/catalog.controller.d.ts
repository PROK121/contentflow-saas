import type { Request } from 'express';
import { CatalogService } from './catalog.service';
import { CreateCatalogItemDto } from './dto/create-catalog-item.dto';
import { UpdateCatalogItemDto } from './dto/update-catalog-item.dto';
export declare class CatalogController {
    private readonly catalogService;
    constructor(catalogService: CatalogService);
    list(): import(".prisma/client").Prisma.PrismaPromise<({
        rightsHolder: {
            id: string;
            legalName: string;
            country: string;
            taxId: string | null;
            isResident: boolean;
            type: import(".prisma/client").$Enums.OrganizationType;
            createdAt: Date;
            updatedAt: Date;
        };
        licenseTerms: {
            id: string;
            territoryCode: string;
            startAt: Date | null;
            endAt: Date | null;
            durationMonths: number | null;
            exclusivity: import(".prisma/client").$Enums.Exclusivity;
            platforms: import(".prisma/client").$Enums.Platform[];
            sublicensingAllowed: boolean;
            languageRights: string[];
            catalogItemId: string;
        }[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        status: import(".prisma/client").$Enums.CatalogItemStatus;
        slug: string;
        assetType: import(".prisma/client").$Enums.AssetType;
        rightsHolderOrgId: string;
        metadata: import("@prisma/client/runtime/library").JsonValue | null;
        posterFileName: string | null;
    })[]>;
    create(body: CreateCatalogItemDto): Promise<{
        rightsHolder: {
            id: string;
            legalName: string;
            country: string;
            taxId: string | null;
            isResident: boolean;
            type: import(".prisma/client").$Enums.OrganizationType;
            createdAt: Date;
            updatedAt: Date;
        };
        licenseTerms: {
            id: string;
            territoryCode: string;
            startAt: Date | null;
            endAt: Date | null;
            durationMonths: number | null;
            exclusivity: import(".prisma/client").$Enums.Exclusivity;
            platforms: import(".prisma/client").$Enums.Platform[];
            sublicensingAllowed: boolean;
            languageRights: string[];
            catalogItemId: string;
        }[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        status: import(".prisma/client").$Enums.CatalogItemStatus;
        slug: string;
        assetType: import(".prisma/client").$Enums.AssetType;
        rightsHolderOrgId: string;
        metadata: import("@prisma/client/runtime/library").JsonValue | null;
        posterFileName: string | null;
    }>;
    getPoster(id: string): Promise<import("@nestjs/common").StreamableFile>;
    uploadPoster(id: string, file: Express.Multer.File): Promise<{
        rightsHolder: {
            id: string;
            legalName: string;
            country: string;
            taxId: string | null;
            isResident: boolean;
            type: import(".prisma/client").$Enums.OrganizationType;
            createdAt: Date;
            updatedAt: Date;
        };
        licenseTerms: {
            id: string;
            territoryCode: string;
            startAt: Date | null;
            endAt: Date | null;
            durationMonths: number | null;
            exclusivity: import(".prisma/client").$Enums.Exclusivity;
            platforms: import(".prisma/client").$Enums.Platform[];
            sublicensingAllowed: boolean;
            languageRights: string[];
            catalogItemId: string;
        }[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        status: import(".prisma/client").$Enums.CatalogItemStatus;
        slug: string;
        assetType: import(".prisma/client").$Enums.AssetType;
        rightsHolderOrgId: string;
        metadata: import("@prisma/client/runtime/library").JsonValue | null;
        posterFileName: string | null;
    }>;
    getOne(id: string): Promise<{
        rightsHolder: {
            id: string;
            legalName: string;
            country: string;
            taxId: string | null;
            isResident: boolean;
            type: import(".prisma/client").$Enums.OrganizationType;
            createdAt: Date;
            updatedAt: Date;
        };
        licenseTerms: {
            id: string;
            territoryCode: string;
            startAt: Date | null;
            endAt: Date | null;
            durationMonths: number | null;
            exclusivity: import(".prisma/client").$Enums.Exclusivity;
            platforms: import(".prisma/client").$Enums.Platform[];
            sublicensingAllowed: boolean;
            languageRights: string[];
            catalogItemId: string;
        }[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        status: import(".prisma/client").$Enums.CatalogItemStatus;
        slug: string;
        assetType: import(".prisma/client").$Enums.AssetType;
        rightsHolderOrgId: string;
        metadata: import("@prisma/client/runtime/library").JsonValue | null;
        posterFileName: string | null;
    }>;
    patch(id: string, body: UpdateCatalogItemDto): Promise<{
        rightsHolder: {
            id: string;
            legalName: string;
            country: string;
            taxId: string | null;
            isResident: boolean;
            type: import(".prisma/client").$Enums.OrganizationType;
            createdAt: Date;
            updatedAt: Date;
        };
        licenseTerms: {
            id: string;
            territoryCode: string;
            startAt: Date | null;
            endAt: Date | null;
            durationMonths: number | null;
            exclusivity: import(".prisma/client").$Enums.Exclusivity;
            platforms: import(".prisma/client").$Enums.Platform[];
            sublicensingAllowed: boolean;
            languageRights: string[];
            catalogItemId: string;
        }[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        status: import(".prisma/client").$Enums.CatalogItemStatus;
        slug: string;
        assetType: import(".prisma/client").$Enums.AssetType;
        rightsHolderOrgId: string;
        metadata: import("@prisma/client/runtime/library").JsonValue | null;
        posterFileName: string | null;
    }>;
    remove(id: string, req: Request): Promise<{
        ok: boolean;
        id: string;
    }>;
}
