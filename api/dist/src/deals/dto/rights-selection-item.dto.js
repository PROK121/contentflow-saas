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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidateRightsDto = exports.SoldHintsDto = exports.RightsSelectionItemDto = void 0;
const client_1 = require("@prisma/client");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
class RightsSelectionItemDto {
}
exports.RightsSelectionItemDto = RightsSelectionItemDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], RightsSelectionItemDto.prototype, "catalogItemId", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], RightsSelectionItemDto.prototype, "territoryCodes", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], RightsSelectionItemDto.prototype, "startAt", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], RightsSelectionItemDto.prototype, "endAt", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsEnum)(client_1.Platform, { each: true }),
    __metadata("design:type", Array)
], RightsSelectionItemDto.prototype, "platforms", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(client_1.Exclusivity),
    __metadata("design:type", String)
], RightsSelectionItemDto.prototype, "exclusivity", void 0);
class SoldHintsDto {
}
exports.SoldHintsDto = SoldHintsDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsUUID)('4', { each: true }),
    __metadata("design:type", Array)
], SoldHintsDto.prototype, "catalogItemIds", void 0);
class ValidateRightsDto {
}
exports.ValidateRightsDto = ValidateRightsDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], ValidateRightsDto.prototype, "catalogItemId", void 0);
__decorate([
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => RightsSelectionItemDto),
    __metadata("design:type", RightsSelectionItemDto)
], ValidateRightsDto.prototype, "selection", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], ValidateRightsDto.prototype, "excludeDealId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ValidateRightsDto.prototype, "adminOverride", void 0);
//# sourceMappingURL=rights-selection-item.dto.js.map