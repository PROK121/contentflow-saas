import { StreamableFile } from '@nestjs/common';
import type { Request } from 'express';
import { ContractsService } from './contracts.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { PatchContractDto } from './dto/patch-contract.dto';
export declare class ContractsController {
    private readonly contractsService;
    constructor(contractsService: ContractsService);
    list(q?: string, limit?: string, archivedOnly?: string, signedOnly?: string): import(".prisma/client").Prisma.PrismaPromise<({
        deal: {
            buyer: {
                id: string;
                legalName: string;
            };
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
        };
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
    })[]>;
    create(body: CreateContractDto): Promise<{
        deal: {
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
        };
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
    }>;
    downloadVersion(contractId: string, versionNum: string, inline?: string): Promise<StreamableFile>;
    versions(contractId: string): Promise<{
        id: string;
        createdAt: Date;
        storageKey: string;
        signedAt: Date | null;
        templateId: string;
        contractId: string;
        version: number;
        sha256: string;
    }[]>;
    diffDeal(contractId: string): Promise<{
        differs: boolean;
        differences: string[];
        contractFingerprint: string | null;
        dealFingerprint: string;
        message: string;
    }>;
    send(contractId: string, body: {
        signingDueAt?: string;
    }): Promise<{
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
    }>;
    sign(contractId: string): Promise<{
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
    }>;
    expireDraft(contractId: string): Promise<{
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
    }>;
    manualVersion(contractId: string, body: {
        note?: string;
    }): Promise<{
        version: {
            id: string;
            createdAt: Date;
            storageKey: string;
            signedAt: Date | null;
            templateId: string;
            contractId: string;
            version: number;
            sha256: string;
        };
        note: string;
    }>;
    one(contractId: string): Promise<{
        deal: {
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
        };
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
    }>;
    patch(contractId: string, body: PatchContractDto): Promise<{
        deal: {
            buyer: {
                id: string;
                legalName: string;
            };
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
        };
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
    }>;
    remove(contractId: string, req: Request): Promise<{
        ok: boolean;
        id: string;
    }>;
}
