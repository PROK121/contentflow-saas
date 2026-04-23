import { PrismaService } from '../prisma/prisma.service';
import { CatalogService } from './catalog.service';
export declare class CatalogExportService {
    private readonly catalog;
    private readonly prisma;
    constructor(catalog: CatalogService, prisma: PrismaService);
    private resolveFontPath;
    buildBuyerCatalogPdf(filters: {
        q?: string;
        assetType?: string;
        status?: string;
        rightsHolderOrgId?: string;
        catalogItemIds?: string[];
    }): Promise<Buffer>;
}
