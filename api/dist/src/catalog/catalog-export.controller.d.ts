import { StreamableFile } from '@nestjs/common';
import { CatalogExportService } from './catalog-export.service';
import { ExportBuyerCatalogDto } from './dto/export-buyer-catalog.dto';
export declare class CatalogExportController {
    private readonly catalogExport;
    constructor(catalogExport: CatalogExportService);
    buyerCatalogPdf(q?: string, assetType?: string, status?: string, rightsHolderOrgId?: string): Promise<StreamableFile>;
    buyerCatalogPdfPost(body: ExportBuyerCatalogDto): Promise<StreamableFile>;
}
