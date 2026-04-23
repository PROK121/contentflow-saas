import { createReadStream } from 'fs';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCommercialOfferDto, OfferTemplateKindDto } from './dto/create-commercial-offer.dto';
export declare class CommercialOffersService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findAll(filters?: {
        archivedOnly?: boolean;
        signedOnly?: boolean;
    }): Promise<{
        id: string;
        title: string;
        storageKey: string;
        archived: boolean;
        clientSigned: boolean;
        signedAt: Date | null;
        sourceOfferId: string | null;
        createdAt: Date;
        updatedAt: Date;
        clientLegalName: string | undefined;
        templateKind: OfferTemplateKindDto;
    }[]>;
    setArchived(id: string, archived: boolean): Promise<{
        id: string;
        updatedAt: Date;
        title: string;
        archived: boolean;
    }>;
    remove(id: string): Promise<{
        ok: boolean;
        id: string;
    }>;
    private assertBuyerOrgHasDeals;
    create(dto: CreateCommercialOfferDto): Promise<{
        id: string;
        title: string;
        storageKey: string;
        createdAt: Date;
    }>;
    getDocumentStream(id: string): Promise<{
        stream: ReturnType<typeof createReadStream>;
        fileName: string;
    } | null>;
    findById(id: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        archived: boolean;
        storageKey: string;
    }>;
}
