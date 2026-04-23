"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DealsController = void 0;
const common_1 = require("@nestjs/common");
const fs_1 = require("fs");
const platform_express_1 = require("@nestjs/platform-express");
const crypto_1 = require("crypto");
const admin_delete_1 = require("../auth/admin-delete");
const fs = __importStar(require("fs"));
const multer_1 = require("multer");
const path = __importStar(require("path"));
const deals_service_1 = require("./deals.service");
const create_deal_dto_1 = require("./dto/create-deal.dto");
const deal_activity_dto_1 = require("./dto/deal-activity.dto");
const update_deal_dto_1 = require("./dto/update-deal.dto");
const rights_selection_item_dto_1 = require("./dto/rights-selection-item.dto");
const serialize_for_json_1 = require("../common/serialize-for-json");
const deal_document_slots_1 = require("./deal-document-slots");
function dealFileUploadOptions() {
    return {
        storage: (0, multer_1.diskStorage)({
            destination: (req, _file, cb) => {
                const dealId = req.params['id'];
                const root = process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'uploads');
                const dir = path.join(root, 'deals', dealId);
                fs.mkdirSync(dir, { recursive: true });
                cb(null, dir);
            },
            filename: (_req, file, cb) => {
                const ext = path.extname(file.originalname) || '';
                cb(null, `${(0, crypto_1.randomUUID)()}${ext}`);
            },
        }),
        limits: { fileSize: 35 * 1024 * 1024 },
    };
}
function dealDocumentUploadOptions() {
    return {
        storage: (0, multer_1.diskStorage)({
            destination: (req, _file, cb) => {
                const dealId = req.params['id'];
                const root = process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'uploads');
                const dir = path.join(root, 'deals', dealId, 'documents');
                fs.mkdirSync(dir, { recursive: true });
                cb(null, dir);
            },
            filename: (req, file, cb) => {
                const slot = req.params['slot'];
                const ext = path.extname(file.originalname) || '';
                cb(null, `${slot}${ext.toLowerCase()}`);
            },
        }),
        limits: { fileSize: 35 * 1024 * 1024 },
    };
}
let DealsController = class DealsController {
    constructor(dealsService) {
        this.dealsService = dealsService;
    }
    soldHints(body) {
        return this.dealsService.soldHints(body.catalogItemIds);
    }
    validateRights(body) {
        return this.dealsService.validateRights(body);
    }
    list(stage, q, ownerUserId, buyerOrgId, currency, catalogItemId, kind, archived, limit) {
        const take = limit != null && limit !== '' ? Number.parseInt(limit, 10) : undefined;
        return this.dealsService.findAll({
            stage,
            q,
            ownerUserId,
            buyerOrgId,
            currency,
            catalogItemId,
            kind,
            archived: archived === 'true' || archived === '1',
            take: Number.isFinite(take) ? take : undefined,
        });
    }
    create(body) {
        return this.dealsService.create(body);
    }
    duplicate(id) {
        return this.dealsService.duplicate(id);
    }
    async paymentPreview(id) {
        return this.dealsService.paymentPreview(id);
    }
    async downloadDealDocument(dealId, slot) {
        if (!(0, deal_document_slots_1.isDealDocumentSlot)(slot)) {
            throw new common_1.BadRequestException('Неизвестный тип документа');
        }
        return this.dealsService.getDealDocumentFile(dealId, slot);
    }
    async uploadDealDocument(dealId, slot, file) {
        if (!(0, deal_document_slots_1.isDealDocumentSlot)(slot)) {
            if (file?.path && (0, fs_1.existsSync)(file.path))
                (0, fs_1.unlinkSync)(file.path);
            throw new common_1.BadRequestException('Неизвестный тип документа');
        }
        if (!file)
            throw new common_1.BadRequestException('Файл обязателен');
        const deal = await this.dealsService.uploadDealDocument(dealId, slot, file);
        return (0, serialize_for_json_1.serializeForJson)(deal);
    }
    async deleteDealDocument(dealId, slot) {
        if (!(0, deal_document_slots_1.isDealDocumentSlot)(slot)) {
            throw new common_1.BadRequestException('Неизвестный тип документа');
        }
        const deal = await this.dealsService.deleteDealDocument(dealId, slot);
        return (0, serialize_for_json_1.serializeForJson)(deal);
    }
    async downloadActivityFile(dealId, activityId) {
        return this.dealsService.getActivityFile(dealId, activityId);
    }
    async getOne(id) {
        const deal = await this.dealsService.findOne(id);
        if (!deal)
            throw new common_1.NotFoundException();
        return (0, serialize_for_json_1.serializeForJson)(deal);
    }
    async patch(id, body) {
        return this.dealsService.update(id, body);
    }
    async remove(id, req) {
        (0, admin_delete_1.assertAdminDeleteUser)(req.user);
        return this.dealsService.removeDeal(id);
    }
    async uploadActivityFile(dealId, file, message, userId) {
        if (!file)
            throw new common_1.BadRequestException('Файл обязателен');
        return this.dealsService.addActivityFile(dealId, file, {
            message,
            userId,
        });
    }
    async activity(id, body) {
        return this.dealsService.addActivity(id, body);
    }
};
exports.DealsController = DealsController;
__decorate([
    (0, common_1.Post)('sold-hints'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [rights_selection_item_dto_1.SoldHintsDto]),
    __metadata("design:returntype", void 0)
], DealsController.prototype, "soldHints", null);
__decorate([
    (0, common_1.Post)('rights/validate'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [rights_selection_item_dto_1.ValidateRightsDto]),
    __metadata("design:returntype", void 0)
], DealsController.prototype, "validateRights", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('stage')),
    __param(1, (0, common_1.Query)('q')),
    __param(2, (0, common_1.Query)('ownerUserId')),
    __param(3, (0, common_1.Query)('buyerOrgId')),
    __param(4, (0, common_1.Query)('currency')),
    __param(5, (0, common_1.Query)('catalogItemId')),
    __param(6, (0, common_1.Query)('kind')),
    __param(7, (0, common_1.Query)('archived')),
    __param(8, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String, String, String, String, String]),
    __metadata("design:returntype", void 0)
], DealsController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_deal_dto_1.CreateDealDto]),
    __metadata("design:returntype", void 0)
], DealsController.prototype, "create", null);
__decorate([
    (0, common_1.Post)(':id/duplicate'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], DealsController.prototype, "duplicate", null);
__decorate([
    (0, common_1.Get)(':id/payment-preview'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], DealsController.prototype, "paymentPreview", null);
__decorate([
    (0, common_1.Get)(':id/documents/:slot/file'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('slot')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], DealsController.prototype, "downloadDealDocument", null);
__decorate([
    (0, common_1.Post)(':id/documents/:slot'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', dealDocumentUploadOptions())),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('slot')),
    __param(2, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], DealsController.prototype, "uploadDealDocument", null);
__decorate([
    (0, common_1.Delete)(':id/documents/:slot'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('slot')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], DealsController.prototype, "deleteDealDocument", null);
__decorate([
    (0, common_1.Get)(':id/activities/:activityId/file'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('activityId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], DealsController.prototype, "downloadActivityFile", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], DealsController.prototype, "getOne", null);
__decorate([
    (0, common_1.Patch)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_deal_dto_1.UpdateDealDto]),
    __metadata("design:returntype", Promise)
], DealsController.prototype, "patch", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], DealsController.prototype, "remove", null);
__decorate([
    (0, common_1.Post)(':id/activities/file'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', dealFileUploadOptions())),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.UploadedFile)()),
    __param(2, (0, common_1.Body)('message')),
    __param(3, (0, common_1.Body)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String, String]),
    __metadata("design:returntype", Promise)
], DealsController.prototype, "uploadActivityFile", null);
__decorate([
    (0, common_1.Post)(':id/activities'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, deal_activity_dto_1.DealActivityDto]),
    __metadata("design:returntype", Promise)
], DealsController.prototype, "activity", null);
exports.DealsController = DealsController = __decorate([
    (0, common_1.Controller)('deals'),
    __metadata("design:paramtypes", [deals_service_1.DealsService])
], DealsController);
//# sourceMappingURL=deals.controller.js.map