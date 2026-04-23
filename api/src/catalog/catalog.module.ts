import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller';
import { CatalogExportController } from './catalog-export.controller';
import { CatalogExportService } from './catalog-export.service';
import { CatalogService } from './catalog.service';

@Module({
  controllers: [CatalogController, CatalogExportController],
  providers: [CatalogService, CatalogExportService],
})
export class CatalogModule {}
