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
exports.CommercialOffersController = void 0;
const common_1 = require("@nestjs/common");
const admin_delete_1 = require("../auth/admin-delete");
const create_commercial_offer_dto_1 = require("./dto/create-commercial-offer.dto");
const patch_commercial_offer_dto_1 = require("./dto/patch-commercial-offer.dto");
const commercial_offers_service_1 = require("./commercial-offers.service");
let CommercialOffersController = class CommercialOffersController {
    constructor(commercialOffersService) {
        this.commercialOffersService = commercialOffersService;
    }
    list(archivedOnly, signedOnly) {
        const arch = archivedOnly === 'true' || archivedOnly === '1' || archivedOnly === 'yes';
        const signed = signedOnly === 'true' || signedOnly === '1' || signedOnly === 'yes';
        return this.commercialOffersService.findAll({
            archivedOnly: arch,
            signedOnly: signed,
        });
    }
    create(body) {
        return this.commercialOffersService.create(body);
    }
    patch(id, body) {
        return this.commercialOffersService.setArchived(id, body.archived);
    }
    remove(id, req) {
        (0, admin_delete_1.assertAdminDeleteUser)(req.user);
        return this.commercialOffersService.remove(id);
    }
    async document(id) {
        const doc = await this.commercialOffersService.getDocumentStream(id);
        if (!doc)
            throw new common_1.NotFoundException();
        const asciiName = doc.fileName.replace(/[^\x20-\x7E]+/g, '_').replace(/"/g, '') ||
            'offer.docx';
        const utf8Name = encodeURIComponent(doc.fileName);
        return new common_1.StreamableFile(doc.stream, {
            type: 'application/pdf',
            disposition: `attachment; filename="${asciiName}"; filename*=UTF-8''${utf8Name}`,
        });
    }
    one(id) {
        return this.commercialOffersService.findById(id);
    }
};
exports.CommercialOffersController = CommercialOffersController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('archivedOnly')),
    __param(1, (0, common_1.Query)('signedOnly')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], CommercialOffersController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_commercial_offer_dto_1.CreateCommercialOfferDto]),
    __metadata("design:returntype", void 0)
], CommercialOffersController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, patch_commercial_offer_dto_1.PatchCommercialOfferDto]),
    __metadata("design:returntype", void 0)
], CommercialOffersController.prototype, "patch", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], CommercialOffersController.prototype, "remove", null);
__decorate([
    (0, common_1.Get)(':id/document'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CommercialOffersController.prototype, "document", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CommercialOffersController.prototype, "one", null);
exports.CommercialOffersController = CommercialOffersController = __decorate([
    (0, common_1.Controller)('commercial-offers'),
    __metadata("design:paramtypes", [commercial_offers_service_1.CommercialOffersService])
], CommercialOffersController);
//# sourceMappingURL=commercial-offers.controller.js.map