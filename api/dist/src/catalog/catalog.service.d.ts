import { StreamableFile } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCatalogItemDto } from './dto/create-catalog-item.dto';
import { UpdateCatalogItemDto } from './dto/update-catalog-item.dto';
export declare class CatalogService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private allocateUniqueSlug;
    findAll(): Prisma.PrismaPromise<({
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
        metadata: Prisma.JsonValue | null;
        posterFileName: string | null;
    })[]>;
    findForBuyerCatalog(filters: {
        q?: string;
        assetType?: string;
        status?: string;
        rightsHolderOrgId?: string;
        catalogItemIds?: string[];
    }): Promise<({
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
        metadata: Prisma.JsonValue | null;
        posterFileName: string | null;
    })[]>;
    findOne(id: string): Promise<{
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
        metadata: Prisma.JsonValue | null;
        posterFileName: string | null;
    }>;
    update(id: string, dto: UpdateCatalogItemDto): Promise<{
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
        metadata: Prisma.JsonValue | null;
        posterFileName: string | null;
    }>;
    create(dto: CreateCatalogItemDto): Promise<{
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
        metadata: Prisma.JsonValue | null;
        posterFileName: string | null;
    }>;
    attachPoster(itemId: string, file: Express.Multer.File): Promise<{
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
        metadata: Prisma.JsonValue | null;
        posterFileName: string | null;
    }>;
    getPosterFile(itemId: string): Promise<StreamableFile>;
    removeCatalogItem(id: string): Promise<{
        ok: boolean;
        id: string;
    }>;
}
