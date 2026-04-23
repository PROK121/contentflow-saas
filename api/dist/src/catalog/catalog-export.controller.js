"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CatalogExportController = void 0;
const common_1 = require("@nestjs/common");
const catalog_export_service_1 = require("./catalog-export.service");
const export_buyer_catalog_dto_1 = require("./dto/export-buyer-catalog.dto");
let CatalogExportController = class CatalogExportController {
    constructor(catalogExport) {
        this.catalogExport = catalogExport;
    }
    async buyerCatalogPdf(q, assetType, status, rightsHolderOrgId) {
        const buf = await this.catalogExport.buildBuyerCatalogPdf({
            q,
            assetType,
            status,
            rightsHolderOrgId,
        });
        return new common_1.StreamableFile(buf, {
            type: 'application/pdf',
            disposition: 'attachment; filename="contentflow-katalog.pdf"',
        });
    }
    async buyerCatalogPdfPost(body) {
        const buf = await this.catalogExport.buildBuyerCatalogPdf({
            q: body.q,
            assetType: body.assetType,
            status: body.status,
            rightsHolderOrgId: body.rightsHolderOrgId,
            catalogItemIds: body.catalogItemIds,
        });
        return new common_1.StreamableFile(buf, {
            type: 'application/pdf',
            disposition: 'attachment; filename="contentflow-katalog.pdf"',
        });
    }
};
exports.CatalogExportController = CatalogExportController;
__decorate([
    (0, common_1.Get)('export/buyer-catalog.pdf'),
    __param(0, (0, common_1.Query)('q')),
    __param(1, (0, common_1.Query)('assetType')),
    __param(2, (0, common_1.Query)('status')),
    __param(3, (0, common_1.Query)('rightsHolderOrgId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", Promise)
], CatalogExportController.prototype, "buyerCatalogPdf", null);
__decorate([
    (0, common_1.Post)('export/buyer-catalog.pdf'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [export_buyer_catalog_dto_1.ExportBuyerCatalogDto]),
    __metadata("design:returntype", Promise)
], CatalogExportController.prototype, "buyerCatalogPdfPost", null);
exports.CatalogExportController = CatalogExportController = __decorate([
    (0, common_1.Controller)('catalog'),
    __metadata("design:paramtypes", [catalog_export_service_1.CatalogExportService])
], CatalogExportController);
//# sourceMappingURL=catalog-export.controller.js.map