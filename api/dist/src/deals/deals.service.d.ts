import { StreamableFile } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDealDto } from './dto/create-deal.dto';
import { DealActivityDto } from './dto/deal-activity.dto';
import { UpdateDealDto } from './dto/update-deal.dto';
import { ValidateRightsDto } from './dto/rights-selection-item.dto';
import type { DealDocumentSlot } from './deal-document-slots';
export declare class DealsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private syncUploadedPdfToLatestContractVersion;
    findAll(filters?: {
        stage?: string;
        q?: string;
        ownerUserId?: string;
        buyerOrgId?: string;
        currency?: string;
        catalogItemId?: string;
        kind?: string;
        archived?: boolean;
        take?: number;
    }): Prisma.PrismaPromise<({
        owner: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            email: string;
            organizationId: string | null;
            passwordHash: string | null;
            displayName: string | null;
            role: import(".prisma/client").$Enums.UserRole;
            locale: string;
        };
        buyer: {
            id: string;
            legalName: string;
            country: string;
            taxId: string | null;
            isResident: boolean;
            type: import(".prisma/client").$Enums.OrganizationType;
            createdAt: Date;
            updatedAt: Date;
        };
        catalogItems: ({
            catalogItem: {
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
            };
        } & {
            rightsSelection: Prisma.JsonValue | null;
            catalogItemId: string;
            dealId: string;
        })[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        ownerUserId: string;
        title: string;
        kind: import(".prisma/client").$Enums.DealKind;
        stage: import(".prisma/client").$Enums.DealStage;
        archived: boolean;
        currency: string;
        expectedCloseAt: Date | null;
        actualCloseAt: Date | null;
        commercialSnapshot: Prisma.JsonValue | null;
        dealDocuments: Prisma.JsonValue | null;
        buyerOrgId: string;
    })[]>;
    duplicate(sourceId: string): Promise<({
        owner: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            email: string;
            organizationId: string | null;
            passwordHash: string | null;
            displayName: string | null;
            role: import(".prisma/client").$Enums.UserRole;
            locale: string;
        };
        buyer: {
            id: string;
            legalName: string;
            country: string;
            taxId: string | null;
            isResident: boolean;
            type: import(".prisma/client").$Enums.OrganizationType;
            createdAt: Date;
            updatedAt: Date;
        };
        catalogItems: ({
            catalogItem: {
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
            };
        } & {
            rightsSelection: Prisma.JsonValue | null;
            catalogItemId: string;
            dealId: string;
        })[];
        contracts: ({
            versions: {
                version: number;
            }[];
        } & {
            number: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            archived: boolean;
            currency: string;
            status: import(".prisma/client").$Enums.ContractStatus;
            amount: Prisma.Decimal;
            dealId: string;
            territory: string;
            templateId: string | null;
            termEndAt: Date;
            fxRateFixed: Prisma.Decimal | null;
            fxRateSource: string | null;
            fxLockedAt: Date | null;
            rightsPayload: Prisma.JsonValue | null;
            signingDueAt: Date | null;
            dealSnapshotFingerprint: string | null;
            clientCabinetSigned: boolean;
            cabinetSignedAt: Date | null;
            sourceContractId: string | null;
        })[];
        payments: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            currency: string;
            dueAt: Date | null;
            status: import(".prisma/client").$Enums.PaymentStatus;
            amount: Prisma.Decimal;
            dealId: string | null;
            contractId: string | null;
            direction: import(".prisma/client").$Enums.PaymentDirection;
            withholdingTaxAmount: Prisma.Decimal | null;
            netAmount: Prisma.Decimal | null;
            paidAt: Date | null;
        }[];
        activities: ({
            user: {
                id: string;
                email: string;
            } | null;
        } & {
            id: string;
            createdAt: Date;
            kind: import(".prisma/client").$Enums.DealActivityKind;
            metadata: Prisma.JsonValue | null;
            message: string;
            dealId: string;
            userId: string | null;
        })[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        ownerUserId: string;
        title: string;
        kind: import(".prisma/client").$Enums.DealKind;
        stage: import(".prisma/client").$Enums.DealStage;
        archived: boolean;
        currency: string;
        expectedCloseAt: Date | null;
        actualCloseAt: Date | null;
        commercialSnapshot: Prisma.JsonValue | null;
        dealDocuments: Prisma.JsonValue | null;
        buyerOrgId: string;
    }) | null>;
    findOne(id: string): Prisma.Prisma__DealClient<({
        owner: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            email: string;
            organizationId: string | null;
            passwordHash: string | null;
            displayName: string | null;
            role: import(".prisma/client").$Enums.UserRole;
            locale: string;
        };
        buyer: {
            id: string;
            legalName: string;
            country: string;
            taxId: string | null;
            isResident: boolean;
            type: import(".prisma/client").$Enums.OrganizationType;
            createdAt: Date;
            updatedAt: Date;
        };
        catalogItems: ({
            catalogItem: {
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
            };
        } & {
            rightsSelection: Prisma.JsonValue | null;
            catalogItemId: string;
            dealId: string;
        })[];
        contracts: ({
            versions: {
                version: number;
            }[];
        } & {
            number: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            archived: boolean;
            currency: string;
            status: import(".prisma/client").$Enums.ContractStatus;
            amount: Prisma.Decimal;
            dealId: string;
            territory: string;
            templateId: string | null;
            termEndAt: Date;
            fxRateFixed: Prisma.Decimal | null;
            fxRateSource: string | null;
            fxLockedAt: Date | null;
            rightsPayload: Prisma.JsonValue | null;
            signingDueAt: Date | null;
            dealSnapshotFingerprint: string | null;
            clientCabinetSigned: boolean;
            cabinetSignedAt: Date | null;
            sourceContractId: string | null;
        })[];
        payments: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            currency: string;
            dueAt: Date | null;
            status: import(".prisma/client").$Enums.PaymentStatus;
            amount: Prisma.Decimal;
            dealId: string | null;
            contractId: string | null;
            direction: import(".prisma/client").$Enums.PaymentDirection;
            withholdingTaxAmount: Prisma.Decimal | null;
            netAmount: Prisma.Decimal | null;
            paidAt: Date | null;
        }[];
        activities: ({
            user: {
                id: string;
                email: string;
            } | null;
        } & {
            id: string;
            createdAt: Date;
            kind: import(".prisma/client").$Enums.DealActivityKind;
            metadata: Prisma.JsonValue | null;
            message: string;
            dealId: string;
            userId: string | null;
        })[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        ownerUserId: string;
        title: string;
        kind: import(".prisma/client").$Enums.DealKind;
        stage: import(".prisma/client").$Enums.DealStage;
        archived: boolean;
        currency: string;
        expectedCloseAt: Date | null;
        actualCloseAt: Date | null;
        commercialSnapshot: Prisma.JsonValue | null;
        dealDocuments: Prisma.JsonValue | null;
        buyerOrgId: string;
    }) | null, null, import("@prisma/client/runtime/library").DefaultArgs>;
    dealFingerprint(deal: {
        title: string;
        buyerOrgId: string;
        currency: string;
        catalogItems: {
            catalogItemId: string;
            rightsSelection: Prisma.JsonValue | null;
        }[];
    }): string;
    create(data: CreateDealDto): Promise<({
        owner: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            email: string;
            organizationId: string | null;
            passwordHash: string | null;
            displayName: string | null;
            role: import(".prisma/client").$Enums.UserRole;
            locale: string;
        };
        buyer: {
            id: string;
            legalName: string;
            country: string;
            taxId: string | null;
            isResident: boolean;
            type: import(".prisma/client").$Enums.OrganizationType;
            createdAt: Date;
            updatedAt: Date;
        };
        catalogItems: ({
            catalogItem: {
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
            };
        } & {
            rightsSelection: Prisma.JsonValue | null;
            catalogItemId: string;
            dealId: string;
        })[];
        contracts: ({
            versions: {
                version: number;
            }[];
        } & {
            number: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            archived: boolean;
            currency: string;
            status: import(".prisma/client").$Enums.ContractStatus;
            amount: Prisma.Decimal;
            dealId: string;
            territory: string;
            templateId: string | null;
            termEndAt: Date;
            fxRateFixed: Prisma.Decimal | null;
            fxRateSource: string | null;
            fxLockedAt: Date | null;
            rightsPayload: Prisma.JsonValue | null;
            signingDueAt: Date | null;
            dealSnapshotFingerprint: string | null;
            clientCabinetSigned: boolean;
            cabinetSignedAt: Date | null;
            sourceContractId: string | null;
        })[];
        payments: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            currency: string;
            dueAt: Date | null;
            status: import(".prisma/client").$Enums.PaymentStatus;
            amount: Prisma.Decimal;
            dealId: string | null;
            contractId: string | null;
            direction: import(".prisma/client").$Enums.PaymentDirection;
            withholdingTaxAmount: Prisma.Decimal | null;
            netAmount: Prisma.Decimal | null;
            paidAt: Date | null;
        }[];
        activities: ({
            user: {
                id: string;
                email: string;
            } | null;
        } & {
            id: string;
            createdAt: Date;
            kind: import(".prisma/client").$Enums.DealActivityKind;
            metadata: Prisma.JsonValue | null;
            message: string;
            dealId: string;
            userId: string | null;
        })[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        ownerUserId: string;
        title: string;
        kind: import(".prisma/client").$Enums.DealKind;
        stage: import(".prisma/client").$Enums.DealStage;
        archived: boolean;
        currency: string;
        expectedCloseAt: Date | null;
        actualCloseAt: Date | null;
        commercialSnapshot: Prisma.JsonValue | null;
        dealDocuments: Prisma.JsonValue | null;
        buyerOrgId: string;
    }) | null>;
    private toRightsJson;
    update(id: string, dto: UpdateDealDto): Promise<({
        owner: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            email: string;
            organizationId: string | null;
            passwordHash: string | null;
            displayName: string | null;
            role: import(".prisma/client").$Enums.UserRole;
            locale: string;
        };
        buyer: {
            id: string;
            legalName: string;
            country: string;
            taxId: string | null;
            isResident: boolean;
            type: import(".prisma/client").$Enums.OrganizationType;
            createdAt: Date;
            updatedAt: Date;
        };
        catalogItems: ({
            catalogItem: {
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
            };
        } & {
            rightsSelection: Prisma.JsonValue | null;
            catalogItemId: string;
            dealId: string;
        })[];
        contracts: ({
            versions: {
                version: number;
            }[];
        } & {
            number: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            archived: boolean;
            currency: string;
            status: import(".prisma/client").$Enums.ContractStatus;
            amount: Prisma.Decimal;
            dealId: string;
            territory: string;
            templateId: string | null;
            termEndAt: Date;
            fxRateFixed: Prisma.Decimal | null;
            fxRateSource: string | null;
            fxLockedAt: Date | null;
            rightsPayload: Prisma.JsonValue | null;
            signingDueAt: Date | null;
            dealSnapshotFingerprint: string | null;
            clientCabinetSigned: boolean;
            cabinetSignedAt: Date | null;
            sourceContractId: string | null;
        })[];
        payments: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            currency: string;
            dueAt: Date | null;
            status: import(".prisma/client").$Enums.PaymentStatus;
            amount: Prisma.Decimal;
            dealId: string | null;
            contractId: string | null;
            direction: import(".prisma/client").$Enums.PaymentDirection;
            withholdingTaxAmount: Prisma.Decimal | null;
            netAmount: Prisma.Decimal | null;
            paidAt: Date | null;
        }[];
        activities: ({
            user: {
                id: string;
                email: string;
            } | null;
        } & {
            id: string;
            createdAt: Date;
            kind: import(".prisma/client").$Enums.DealActivityKind;
            metadata: Prisma.JsonValue | null;
            message: string;
            dealId: string;
            userId: string | null;
        })[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        ownerUserId: string;
        title: string;
        kind: import(".prisma/client").$Enums.DealKind;
        stage: import(".prisma/client").$Enums.DealStage;
        archived: boolean;
        currency: string;
        expectedCloseAt: Date | null;
        actualCloseAt: Date | null;
        commercialSnapshot: Prisma.JsonValue | null;
        dealDocuments: Prisma.JsonValue | null;
        buyerOrgId: string;
    }) | null>;
    addActivity(dealId: string, dto: DealActivityDto): Promise<{
        id: string;
        createdAt: Date;
        kind: import(".prisma/client").$Enums.DealActivityKind;
        metadata: Prisma.JsonValue | null;
        message: string;
        dealId: string;
        userId: string | null;
    }>;
    addActivityFile(dealId: string, file: Express.Multer.File, opts?: {
        message?: string;
        userId?: string;
    }): Promise<{
        id: string;
        createdAt: Date;
        kind: import(".prisma/client").$Enums.DealActivityKind;
        metadata: Prisma.JsonValue | null;
        message: string;
        dealId: string;
        userId: string | null;
    }>;
    uploadDealDocument(dealId: string, slot: DealDocumentSlot, file: Express.Multer.File): Promise<({
        owner: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            email: string;
            organizationId: string | null;
            passwordHash: string | null;
            displayName: string | null;
            role: import(".prisma/client").$Enums.UserRole;
            locale: string;
        };
        buyer: {
            id: string;
            legalName: string;
            country: string;
            taxId: string | null;
            isResident: boolean;
            type: import(".prisma/client").$Enums.OrganizationType;
            createdAt: Date;
            updatedAt: Date;
        };
        catalogItems: ({
            catalogItem: {
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
            };
        } & {
            rightsSelection: Prisma.JsonValue | null;
            catalogItemId: string;
            dealId: string;
        })[];
        contracts: ({
            versions: {
                version: number;
            }[];
        } & {
            number: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            archived: boolean;
            currency: string;
            status: import(".prisma/client").$Enums.ContractStatus;
            amount: Prisma.Decimal;
            dealId: string;
            territory: string;
            templateId: string | null;
            termEndAt: Date;
            fxRateFixed: Prisma.Decimal | null;
            fxRateSource: string | null;
            fxLockedAt: Date | null;
            rightsPayload: Prisma.JsonValue | null;
            signingDueAt: Date | null;
            dealSnapshotFingerprint: string | null;
            clientCabinetSigned: boolean;
            cabinetSignedAt: Date | null;
            sourceContractId: string | null;
        })[];
        payments: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            currency: string;
            dueAt: Date | null;
            status: import(".prisma/client").$Enums.PaymentStatus;
            amount: Prisma.Decimal;
            dealId: string | null;
            contractId: string | null;
            direction: import(".prisma/client").$Enums.PaymentDirection;
            withholdingTaxAmount: Prisma.Decimal | null;
            netAmount: Prisma.Decimal | null;
            paidAt: Date | null;
        }[];
        activities: ({
            user: {
                id: string;
                email: string;
            } | null;
        } & {
            id: string;
            createdAt: Date;
            kind: import(".prisma/client").$Enums.DealActivityKind;
            metadata: Prisma.JsonValue | null;
            message: string;
            dealId: string;
            userId: string | null;
        })[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        ownerUserId: string;
        title: string;
        kind: import(".prisma/client").$Enums.DealKind;
        stage: import(".prisma/client").$Enums.DealStage;
        archived: boolean;
        currency: string;
        expectedCloseAt: Date | null;
        actualCloseAt: Date | null;
        commercialSnapshot: Prisma.JsonValue | null;
        dealDocuments: Prisma.JsonValue | null;
        buyerOrgId: string;
    }) | null>;
    getDealDocumentFile(dealId: string, slot: DealDocumentSlot): Promise<StreamableFile>;
    deleteDealDocument(dealId: string, slot: DealDocumentSlot): Promise<({
        owner: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            email: string;
            organizationId: string | null;
            passwordHash: string | null;
            displayName: string | null;
            role: import(".prisma/client").$Enums.UserRole;
            locale: string;
        };
        buyer: {
            id: string;
            legalName: string;
            country: string;
            taxId: string | null;
            isResident: boolean;
            type: import(".prisma/client").$Enums.OrganizationType;
            createdAt: Date;
            updatedAt: Date;
        };
        catalogItems: ({
            catalogItem: {
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
            };
        } & {
            rightsSelection: Prisma.JsonValue | null;
            catalogItemId: string;
            dealId: string;
        })[];
        contracts: ({
            versions: {
                version: number;
            }[];
        } & {
            number: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            archived: boolean;
            currency: string;
            status: import(".prisma/client").$Enums.ContractStatus;
            amount: Prisma.Decimal;
            dealId: string;
            territory: string;
            templateId: string | null;
            termEndAt: Date;
            fxRateFixed: Prisma.Decimal | null;
            fxRateSource: string | null;
            fxLockedAt: Date | null;
            rightsPayload: Prisma.JsonValue | null;
            signingDueAt: Date | null;
            dealSnapshotFingerprint: string | null;
            clientCabinetSigned: boolean;
            cabinetSignedAt: Date | null;
            sourceContractId: string | null;
        })[];
        payments: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            currency: string;
            dueAt: Date | null;
            status: import(".prisma/client").$Enums.PaymentStatus;
            amount: Prisma.Decimal;
            dealId: string | null;
            contractId: string | null;
            direction: import(".prisma/client").$Enums.PaymentDirection;
            withholdingTaxAmount: Prisma.Decimal | null;
            netAmount: Prisma.Decimal | null;
            paidAt: Date | null;
        }[];
        activities: ({
            user: {
                id: string;
                email: string;
            } | null;
        } & {
            id: string;
            createdAt: Date;
            kind: import(".prisma/client").$Enums.DealActivityKind;
            metadata: Prisma.JsonValue | null;
            message: string;
            dealId: string;
            userId: string | null;
        })[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        ownerUserId: string;
        title: string;
        kind: import(".prisma/client").$Enums.DealKind;
        stage: import(".prisma/client").$Enums.DealStage;
        archived: boolean;
        currency: string;
        expectedCloseAt: Date | null;
        actualCloseAt: Date | null;
        commercialSnapshot: Prisma.JsonValue | null;
        dealDocuments: Prisma.JsonValue | null;
        buyerOrgId: string;
    }) | null>;
    getActivityFile(dealId: string, activityId: string): Promise<StreamableFile>;
    soldHints(catalogItemIds: string[]): Promise<{
        catalogItemIdsWithSales: string[];
    }>;
    validateRights(body: ValidateRightsDto): Promise<{
        licenseGaps: string[];
        blockingConflicts: {
            territory: string;
            reason: string;
            dealId: string;
        }[];
        partialOverlaps: {
            territory: string;
            dealId: string;
        }[];
        canContinue: boolean;
        allowOverride: boolean;
    }>;
    paymentPreview(dealId: string): Promise<{
        gross: string;
        taxRate: string;
        taxPercentLabel: string;
        withholdingTaxAmount: string;
        net: string;
        vatIncluded: boolean;
        projectAdministrationEnabled: boolean;
        projectAdministrationDeduction: string;
        currency: string;
        buyerIsResident: boolean;
        taxNote: string;
        payments: {
            id: string;
            amount: string;
            currency: string;
            status: import(".prisma/client").$Enums.PaymentStatus;
            paidAt: Date | null;
        }[];
        paidSum: string;
        partialPaymentHint: boolean;
        fxNote: string | null;
    }>;
    removeDeal(dealId: string): Promise<{
        ok: boolean;
        id: string;
    }>;
}
