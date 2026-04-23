import type { Request } from 'express';
import { DealsService } from './deals.service';
import { CreateDealDto } from './dto/create-deal.dto';
import { DealActivityDto } from './dto/deal-activity.dto';
import { UpdateDealDto } from './dto/update-deal.dto';
import { SoldHintsDto, ValidateRightsDto } from './dto/rights-selection-item.dto';
export declare class DealsController {
    private readonly dealsService;
    constructor(dealsService: DealsService);
    soldHints(body: SoldHintsDto): Promise<{
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
    list(stage?: string, q?: string, ownerUserId?: string, buyerOrgId?: string, currency?: string, catalogItemId?: string, kind?: string, archived?: string, limit?: string): import(".prisma/client").Prisma.PrismaPromise<({
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
                metadata: import("@prisma/client/runtime/library").JsonValue | null;
                posterFileName: string | null;
            };
        } & {
            rightsSelection: import("@prisma/client/runtime/library").JsonValue | null;
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
        commercialSnapshot: import("@prisma/client/runtime/library").JsonValue | null;
        dealDocuments: import("@prisma/client/runtime/library").JsonValue | null;
        buyerOrgId: string;
    })[]>;
    create(body: CreateDealDto): Promise<({
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
                metadata: import("@prisma/client/runtime/library").JsonValue | null;
                posterFileName: string | null;
            };
        } & {
            rightsSelection: import("@prisma/client/runtime/library").JsonValue | null;
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
            amount: import("@prisma/client/runtime/library").Decimal;
            dealId: string;
            territory: string;
            templateId: string | null;
            termEndAt: Date;
            fxRateFixed: import("@prisma/client/runtime/library").Decimal | null;
            fxRateSource: string | null;
            fxLockedAt: Date | null;
            rightsPayload: import("@prisma/client/runtime/library").JsonValue | null;
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
            amount: import("@prisma/client/runtime/library").Decimal;
            dealId: string | null;
            contractId: string | null;
            direction: import(".prisma/client").$Enums.PaymentDirection;
            withholdingTaxAmount: import("@prisma/client/runtime/library").Decimal | null;
            netAmount: import("@prisma/client/runtime/library").Decimal | null;
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
            metadata: import("@prisma/client/runtime/library").JsonValue | null;
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
        commercialSnapshot: import("@prisma/client/runtime/library").JsonValue | null;
        dealDocuments: import("@prisma/client/runtime/library").JsonValue | null;
        buyerOrgId: string;
    }) | null>;
    duplicate(id: string): Promise<({
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
                metadata: import("@prisma/client/runtime/library").JsonValue | null;
                posterFileName: string | null;
            };
        } & {
            rightsSelection: import("@prisma/client/runtime/library").JsonValue | null;
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
            amount: import("@prisma/client/runtime/library").Decimal;
            dealId: string;
            territory: string;
            templateId: string | null;
            termEndAt: Date;
            fxRateFixed: import("@prisma/client/runtime/library").Decimal | null;
            fxRateSource: string | null;
            fxLockedAt: Date | null;
            rightsPayload: import("@prisma/client/runtime/library").JsonValue | null;
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
            amount: import("@prisma/client/runtime/library").Decimal;
            dealId: string | null;
            contractId: string | null;
            direction: import(".prisma/client").$Enums.PaymentDirection;
            withholdingTaxAmount: import("@prisma/client/runtime/library").Decimal | null;
            netAmount: import("@prisma/client/runtime/library").Decimal | null;
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
            metadata: import("@prisma/client/runtime/library").JsonValue | null;
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
        commercialSnapshot: import("@prisma/client/runtime/library").JsonValue | null;
        dealDocuments: import("@prisma/client/runtime/library").JsonValue | null;
        buyerOrgId: string;
    }) | null>;
    paymentPreview(id: string): Promise<{
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
    downloadDealDocument(dealId: string, slot: string): Promise<import("@nestjs/common").StreamableFile>;
    uploadDealDocument(dealId: string, slot: string, file: Express.Multer.File | undefined): Promise<({
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
                metadata: import("@prisma/client/runtime/library").JsonValue | null;
                posterFileName: string | null;
            };
        } & {
            rightsSelection: import("@prisma/client/runtime/library").JsonValue | null;
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
            amount: import("@prisma/client/runtime/library").Decimal;
            dealId: string;
            territory: string;
            templateId: string | null;
            termEndAt: Date;
            fxRateFixed: import("@prisma/client/runtime/library").Decimal | null;
            fxRateSource: string | null;
            fxLockedAt: Date | null;
            rightsPayload: import("@prisma/client/runtime/library").JsonValue | null;
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
            amount: import("@prisma/client/runtime/library").Decimal;
            dealId: string | null;
            contractId: string | null;
            direction: import(".prisma/client").$Enums.PaymentDirection;
            withholdingTaxAmount: import("@prisma/client/runtime/library").Decimal | null;
            netAmount: import("@prisma/client/runtime/library").Decimal | null;
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
            metadata: import("@prisma/client/runtime/library").JsonValue | null;
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
        commercialSnapshot: import("@prisma/client/runtime/library").JsonValue | null;
        dealDocuments: import("@prisma/client/runtime/library").JsonValue | null;
        buyerOrgId: string;
    }) | null>;
    deleteDealDocument(dealId: string, slot: string): Promise<({
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
                metadata: import("@prisma/client/runtime/library").JsonValue | null;
                posterFileName: string | null;
            };
        } & {
            rightsSelection: import("@prisma/client/runtime/library").JsonValue | null;
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
            amount: import("@prisma/client/runtime/library").Decimal;
            dealId: string;
            territory: string;
            templateId: string | null;
            termEndAt: Date;
            fxRateFixed: import("@prisma/client/runtime/library").Decimal | null;
            fxRateSource: string | null;
            fxLockedAt: Date | null;
            rightsPayload: import("@prisma/client/runtime/library").JsonValue | null;
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
            amount: import("@prisma/client/runtime/library").Decimal;
            dealId: string | null;
            contractId: string | null;
            direction: import(".prisma/client").$Enums.PaymentDirection;
            withholdingTaxAmount: import("@prisma/client/runtime/library").Decimal | null;
            netAmount: import("@prisma/client/runtime/library").Decimal | null;
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
            metadata: import("@prisma/client/runtime/library").JsonValue | null;
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
        commercialSnapshot: import("@prisma/client/runtime/library").JsonValue | null;
        dealDocuments: import("@prisma/client/runtime/library").JsonValue | null;
        buyerOrgId: string;
    }) | null>;
    downloadActivityFile(dealId: string, activityId: string): Promise<import("@nestjs/common").StreamableFile>;
    getOne(id: string): Promise<{
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
                metadata: import("@prisma/client/runtime/library").JsonValue | null;
                posterFileName: string | null;
            };
        } & {
            rightsSelection: import("@prisma/client/runtime/library").JsonValue | null;
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
            amount: import("@prisma/client/runtime/library").Decimal;
            dealId: string;
            territory: string;
            templateId: string | null;
            termEndAt: Date;
            fxRateFixed: import("@prisma/client/runtime/library").Decimal | null;
            fxRateSource: string | null;
            fxLockedAt: Date | null;
            rightsPayload: import("@prisma/client/runtime/library").JsonValue | null;
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
            amount: import("@prisma/client/runtime/library").Decimal;
            dealId: string | null;
            contractId: string | null;
            direction: import(".prisma/client").$Enums.PaymentDirection;
            withholdingTaxAmount: import("@prisma/client/runtime/library").Decimal | null;
            netAmount: import("@prisma/client/runtime/library").Decimal | null;
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
            metadata: import("@prisma/client/runtime/library").JsonValue | null;
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
        commercialSnapshot: import("@prisma/client/runtime/library").JsonValue | null;
        dealDocuments: import("@prisma/client/runtime/library").JsonValue | null;
        buyerOrgId: string;
    }>;
    patch(id: string, body: UpdateDealDto): Promise<({
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
                metadata: import("@prisma/client/runtime/library").JsonValue | null;
                posterFileName: string | null;
            };
        } & {
            rightsSelection: import("@prisma/client/runtime/library").JsonValue | null;
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
            amount: import("@prisma/client/runtime/library").Decimal;
            dealId: string;
            territory: string;
            templateId: string | null;
            termEndAt: Date;
            fxRateFixed: import("@prisma/client/runtime/library").Decimal | null;
            fxRateSource: string | null;
            fxLockedAt: Date | null;
            rightsPayload: import("@prisma/client/runtime/library").JsonValue | null;
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
            amount: import("@prisma/client/runtime/library").Decimal;
            dealId: string | null;
            contractId: string | null;
            direction: import(".prisma/client").$Enums.PaymentDirection;
            withholdingTaxAmount: import("@prisma/client/runtime/library").Decimal | null;
            netAmount: import("@prisma/client/runtime/library").Decimal | null;
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
            metadata: import("@prisma/client/runtime/library").JsonValue | null;
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
        commercialSnapshot: import("@prisma/client/runtime/library").JsonValue | null;
        dealDocuments: import("@prisma/client/runtime/library").JsonValue | null;
        buyerOrgId: string;
    }) | null>;
    remove(id: string, req: Request): Promise<{
        ok: boolean;
        id: string;
    }>;
    uploadActivityFile(dealId: string, file: Express.Multer.File | undefined, message?: string, userId?: string): Promise<{
        id: string;
        createdAt: Date;
        kind: import(".prisma/client").$Enums.DealActivityKind;
        metadata: import("@prisma/client/runtime/library").JsonValue | null;
        message: string;
        dealId: string;
        userId: string | null;
    }>;
    activity(id: string, body: DealActivityDto): Promise<{
        id: string;
        createdAt: Date;
        kind: import(".prisma/client").$Enums.DealActivityKind;
        metadata: import("@prisma/client/runtime/library").JsonValue | null;
        message: string;
        dealId: string;
        userId: string | null;
    }>;
}
