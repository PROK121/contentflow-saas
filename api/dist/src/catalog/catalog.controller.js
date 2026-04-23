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
exports.CatalogController = void 0;
const common_1 = require("@nestjs/common");
const admin_delete_1 = require("../auth/admin-delete");
const platform_express_1 = require("@nestjs/platform-express");
const crypto_1 = require("crypto");
const fs = __importStar(require("fs"));
const multer_1 = require("multer");
const path = __importStar(require("path"));
const catalog_service_1 = require("./catalog.service");
const create_catalog_item_dto_1 = require("./dto/create-catalog-item.dto");
const update_catalog_item_dto_1 = require("./dto/update-catalog-item.dto");
function catalogPosterUploadOptions() {
    return {
        storage: (0, multer_1.diskStorage)({
            destination: (req, _file, cb) => {
                const itemId = req.params['id'];
                const root = process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'uploads');
                const dir = path.join(root, 'catalog', itemId);
                fs.mkdirSync(dir, { recursive: true });
                cb(null, dir);
            },
            filename: (_req, file, cb) => {
                const ext = path.extname(file.originalname) || '';
                const safe = ext && /^\.(jpe?g|png|gif|webp)$/i.test(ext)
                    ? ext.toLowerCase()
                    : '.jpg';
                cb(null, `${(0, crypto_1.randomUUID)()}${safe}`);
            },
        }),
        limits: { fileSize: 12 * 1024 * 1024 },
    };
}
let CatalogController = class CatalogController {
    constructor(catalogService) {
        this.catalogService = catalogService;
    }
    list() {
        return this.catalogService.findAll();
    }
    create(body) {
        return this.catalogService.create(body);
    }
    getPoster(id) {
        return this.catalogService.getPosterFile(id);
    }
    uploadPoster(id, file) {
        if (!file) {
            throw new common_1.BadRequestException('Передайте файл поля file');
        }
        return this.catalogService.attachPoster(id, file);
    }
    getOne(id) {
        return this.catalogService.findOne(id);
    }
    patch(id, body) {
        return this.catalogService.update(id, body);
    }
    remove(id, req) {
        (0, admin_delete_1.assertAdminDeleteUser)(req.user);
        return this.catalogService.removeCatalogItem(id);
    }
};
exports.CatalogController = CatalogController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CatalogController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_catalog_item_dto_1.CreateCatalogItemDto]),
    __metadata("design:returntype", void 0)
], CatalogController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(':id/poster'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CatalogController.prototype, "getPoster", null);
__decorate([
    (0, common_1.Post)(':id/poster'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', catalogPosterUploadOptions())),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], CatalogController.prototype, "uploadPoster", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CatalogController.prototype, "getOne", null);
__decorate([
    (0, common_1.Patch)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_catalog_item_dto_1.UpdateCatalogItemDto]),
    __metadata("design:returntype", void 0)
], CatalogController.prototype, "patch", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], CatalogController.prototype, "remove", null);
exports.CatalogController = CatalogController = __decorate([
    (0, common_1.Controller)('catalog/items'),
    __metadata("design:paramtypes", [catalog_service_1.CatalogService])
], CatalogController);
//# sourceMappingURL=catalog.controller.js.map