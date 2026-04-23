import { StreamableFile } from '@nestjs/common';
import type { Request } from 'express';
import { CreateCommercialOfferDto } from './dto/create-commercial-offer.dto';
import { PatchCommercialOfferDto } from './dto/patch-commercial-offer.dto';
import { CommercialOffersService } from './commercial-offers.service';
export declare class CommercialOffersController {
    private readonly commercialOffersService;
    constructor(commercialOffersService: CommercialOffersService);
    list(archivedOnly?: string, signedOnly?: string): Promise<{
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
        templateKind: import("./dto/create-commercial-offer.dto").OfferTemplateKindDto;
    }[]>;
    create(body: CreateCommercialOfferDto): Promise<{
        id: string;
        title: string;
        storageKey: string;
        createdAt: Date;
    }>;
    patch(id: string, body: PatchCommercialOfferDto): Promise<{
        id: string;
        updatedAt: Date;
        title: string;
        archived: boolean;
    }>;
    remove(id: string, req: Request): Promise<{
        ok: boolean;
        id: string;
    }>;
    document(id: string): Promise<StreamableFile>;
    one(id: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        archived: boolean;
        storageKey: string;
    }>;
}
