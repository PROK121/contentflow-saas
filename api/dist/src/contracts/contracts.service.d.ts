import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateContractDto } from './dto/create-contract.dto';
export declare class ContractsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findAll(filters?: {
        q?: string;
        take?: number;
        archivedOnly?: boolean;
        signedOnly?: boolean;
    }): Prisma.PrismaPromise<({
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
            commercialSnapshot: Prisma.JsonValue | null;
            dealDocuments: Prisma.JsonValue | null;
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
    })[]>;
    updateArchived(id: string, archived: boolean): Promise<{
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
            commercialSnapshot: Prisma.JsonValue | null;
            dealDocuments: Prisma.JsonValue | null;
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
    }>;
    findById(id: string): Prisma.Prisma__ContractClient<({
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
        };
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
    }) | null, null, import("@prisma/client/runtime/library").DefaultArgs>;
    getVersionFileForDownload(contractId: string, versionNum: number): Promise<{
        stream: import("fs").ReadStream;
        fileName: string;
    }>;
    private writeContractPlaceholderPdf;
    private buildDealSnapshotFingerprint;
    createDraft(dto: CreateContractDto): Promise<{
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
            commercialSnapshot: Prisma.JsonValue | null;
            dealDocuments: Prisma.JsonValue | null;
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
    }>;
    markSent(contractId: string, signingDueAt?: string): Promise<{
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
    }>;
    markSigned(contractId: string): Promise<{
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
    }>;
    markExpiredDraft(contractId: string): Promise<{
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
    }>;
    compareWithDeal(contractId: string): Promise<{
        differs: boolean;
        differences: string[];
        contractFingerprint: string | null;
        dealFingerprint: string;
        message: string;
    }>;
    addManualVersion(contractId: string, note?: string): Promise<{
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
    versions(contractId: string): Prisma.PrismaPromise<{
        id: string;
        createdAt: Date;
        storageKey: string;
        signedAt: Date | null;
        templateId: string;
        contractId: string;
        version: number;
        sha256: string;
    }[]>;
    removeContract(contractId: string): Promise<{
        ok: boolean;
        id: string;
    }>;
}
