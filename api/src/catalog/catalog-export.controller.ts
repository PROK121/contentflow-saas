import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  StreamableFile,
} from '@nestjs/common';
import { CatalogExportService } from './catalog-export.service';
import { ExportBuyerCatalogDto } from './dto/export-buyer-catalog.dto';

@Controller('catalog')
export class CatalogExportController {
  constructor(private readonly catalogExport: CatalogExportService) {}

  /** PDF-каталог для покупателя; query-параметры совпадают с фильтрами на /content */
  @Get('export/buyer-catalog.pdf')
  async buyerCatalogPdf(
    @Query('q') q?: string,
    @Query('assetType') assetType?: string,
    @Query('status') status?: string,
    @Query('rightsHolderOrgId') rightsHolderOrgId?: string,
  ) {
    const buf = await this.catalogExport.buildBuyerCatalogPdf({
      q,
      assetType,
      status,
      rightsHolderOrgId,
    });
    return new StreamableFile(buf, {
      type: 'application/pdf',
      disposition: 'attachment; filename="contentflow-katalog.pdf"',
    });
  }

  /** То же PDF + опционально `catalogItemIds` — только выбранные тайтлы (с пересечением фильтров). */
  @Post('export/buyer-catalog.pdf')
  async buyerCatalogPdfPost(@Body() body: ExportBuyerCatalogDto) {
    const buf = await this.catalogExport.buildBuyerCatalogPdf({
      q: body.q,
      assetType: body.assetType,
      status: body.status,
      rightsHolderOrgId: body.rightsHolderOrgId,
      catalogItemIds: body.catalogItemIds,
    });
    return new StreamableFile(buf, {
      type: 'application/pdf',
      disposition: 'attachment; filename="contentflow-katalog.pdf"',
    });
  }
}
