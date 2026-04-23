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
exports.ContractsController = void 0;
const common_1 = require("@nestjs/common");
const admin_delete_1 = require("../auth/admin-delete");
const contracts_service_1 = require("./contracts.service");
const create_contract_dto_1 = require("./dto/create-contract.dto");
const patch_contract_dto_1 = require("./dto/patch-contract.dto");
let ContractsController = class ContractsController {
    constructor(contractsService) {
        this.contractsService = contractsService;
    }
    list(q, limit, archivedOnly, signedOnly) {
        const take = limit != null && limit !== '' ? Number.parseInt(limit, 10) : undefined;
        const only = archivedOnly === 'true' || archivedOnly === '1' || archivedOnly === 'yes';
        const signed = signedOnly === 'true' || signedOnly === '1' || signedOnly === 'yes';
        return this.contractsService.findAll({
            q: q?.trim() || undefined,
            take: Number.isFinite(take) ? take : undefined,
            archivedOnly: only,
            signedOnly: signed,
        });
    }
    create(body) {
        return this.contractsService.createDraft(body);
    }
    async downloadVersion(contractId, versionNum, inline) {
        const v = Number.parseInt(versionNum, 10);
        if (!Number.isFinite(v) || v < 1) {
            throw new common_1.BadRequestException('Invalid version');
        }
        const { stream, fileName } = await this.contractsService.getVersionFileForDownload(contractId, v);
        const asciiName = fileName.replace(/[^\x20-\x7E]+/g, '_').replace(/"/g, '') ||
            `contract-v${v}.pdf`;
        const utf8Name = encodeURIComponent(fileName);
        const asInline = inline === '1' || inline === 'true' || inline === 'yes';
        return new common_1.StreamableFile(stream, {
            type: 'application/pdf',
            disposition: asInline
                ? `inline; filename="${asciiName}"; filename*=UTF-8''${utf8Name}`
                : `attachment; filename="${asciiName}"; filename*=UTF-8''${utf8Name}`,
        });
    }
    async versions(contractId) {
        const contract = await this.contractsService.findById(contractId);
        if (!contract)
            throw new common_1.NotFoundException();
        return this.contractsService.versions(contractId);
    }
    async diffDeal(contractId) {
        return this.contractsService.compareWithDeal(contractId);
    }
    async send(contractId, body) {
        return this.contractsService.markSent(contractId, body?.signingDueAt);
    }
    async sign(contractId) {
        return this.contractsService.markSigned(contractId);
    }
    async expireDraft(contractId) {
        return this.contractsService.markExpiredDraft(contractId);
    }
    async manualVersion(contractId, body) {
        return this.contractsService.addManualVersion(contractId, body?.note);
    }
    async one(contractId) {
        const contract = await this.contractsService.findById(contractId);
        if (!contract)
            throw new common_1.NotFoundException();
        return contract;
    }
    async patch(contractId, body) {
        if (body.archived === undefined) {
            throw new common_1.BadRequestException('Укажите archived');
        }
        return this.contractsService.updateArchived(contractId, body.archived);
    }
    async remove(contractId, req) {
        (0, admin_delete_1.assertAdminDeleteUser)(req.user);
        return this.contractsService.removeContract(contractId);
    }
};
exports.ContractsController = ContractsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('q')),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Query)('archivedOnly')),
    __param(3, (0, common_1.Query)('signedOnly')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", void 0)
], ContractsController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_contract_dto_1.CreateContractDto]),
    __metadata("design:returntype", void 0)
], ContractsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(':contractId/versions/:versionNum/download'),
    __param(0, (0, common_1.Param)('contractId')),
    __param(1, (0, common_1.Param)('versionNum')),
    __param(2, (0, common_1.Query)('inline')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], ContractsController.prototype, "downloadVersion", null);
__decorate([
    (0, common_1.Get)(':contractId/versions'),
    __param(0, (0, common_1.Param)('contractId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ContractsController.prototype, "versions", null);
__decorate([
    (0, common_1.Get)(':contractId/diff-deal'),
    __param(0, (0, common_1.Param)('contractId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ContractsController.prototype, "diffDeal", null);
__decorate([
    (0, common_1.Post)(':contractId/send'),
    __param(0, (0, common_1.Param)('contractId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ContractsController.prototype, "send", null);
__decorate([
    (0, common_1.Post)(':contractId/sign'),
    __param(0, (0, common_1.Param)('contractId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ContractsController.prototype, "sign", null);
__decorate([
    (0, common_1.Post)(':contractId/expire-draft'),
    __param(0, (0, common_1.Param)('contractId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ContractsController.prototype, "expireDraft", null);
__decorate([
    (0, common_1.Post)(':contractId/manual-version'),
    __param(0, (0, common_1.Param)('contractId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ContractsController.prototype, "manualVersion", null);
__decorate([
    (0, common_1.Get)(':contractId'),
    __param(0, (0, common_1.Param)('contractId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ContractsController.prototype, "one", null);
__decorate([
    (0, common_1.Patch)(':contractId'),
    __param(0, (0, common_1.Param)('contractId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, patch_contract_dto_1.PatchContractDto]),
    __metadata("design:returntype", Promise)
], ContractsController.prototype, "patch", null);
__decorate([
    (0, common_1.Delete)(':contractId'),
    __param(0, (0, common_1.Param)('contractId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ContractsController.prototype, "remove", null);
exports.ContractsController = ContractsController = __decorate([
    (0, common_1.Controller)('contracts'),
    __metadata("design:paramtypes", [contracts_service_1.ContractsService])
], ContractsController);
//# sourceMappingURL=contracts.controller.js.map