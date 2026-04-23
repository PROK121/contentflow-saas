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
exports.CreateCommercialOfferDto = exports.OfferTemplateKindDto = exports.OfferExclusivityDto = void 0;
const class_validator_1 = require("class-validator");
var OfferExclusivityDto;
(function (OfferExclusivityDto) {
    OfferExclusivityDto["exclusive"] = "exclusive";
    OfferExclusivityDto["co_exclusive"] = "co_exclusive";
    OfferExclusivityDto["non_exclusive"] = "non_exclusive";
})(OfferExclusivityDto || (exports.OfferExclusivityDto = OfferExclusivityDto = {}));
var OfferTemplateKindDto;
(function (OfferTemplateKindDto) {
    OfferTemplateKindDto["po"] = "po";
    OfferTemplateKindDto["platforms"] = "platforms";
})(OfferTemplateKindDto || (exports.OfferTemplateKindDto = OfferTemplateKindDto = {}));
class CreateCommercialOfferDto {
}
exports.CreateCommercialOfferDto = CreateCommercialOfferDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(OfferTemplateKindDto),
    __metadata("design:type", String)
], CreateCommercialOfferDto.prototype, "templateKind", void 0);
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateCommercialOfferDto.prototype, "buyerOrgId", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateCommercialOfferDto.prototype, "offerDate", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], CreateCommercialOfferDto.prototype, "workTitle", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], CreateCommercialOfferDto.prototype, "distributorLine", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], CreateCommercialOfferDto.prototype, "contentTitle", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(32),
    __metadata("design:type", String)
], CreateCommercialOfferDto.prototype, "productionYear", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], CreateCommercialOfferDto.prototype, "contentFormat", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], CreateCommercialOfferDto.prototype, "genre", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", String)
], CreateCommercialOfferDto.prototype, "seriesCount", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], CreateCommercialOfferDto.prototype, "runtime", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], CreateCommercialOfferDto.prototype, "theatricalRelease", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], CreateCommercialOfferDto.prototype, "rightsHolder", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], CreateCommercialOfferDto.prototype, "contentLanguage", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(OfferExclusivityDto),
    __metadata("design:type", String)
], CreateCommercialOfferDto.prototype, "exclusivity", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], CreateCommercialOfferDto.prototype, "territory", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(1000),
    __metadata("design:type", String)
], CreateCommercialOfferDto.prototype, "localization", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], CreateCommercialOfferDto.prototype, "materialsNote", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateCommercialOfferDto.prototype, "promoSupport", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateCommercialOfferDto.prototype, "catalogInclusion", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateCommercialOfferDto.prototype, "contractsAdmin", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateCommercialOfferDto.prototype, "digitization", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], CreateCommercialOfferDto.prototype, "licenseTerm", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(4000),
    __metadata("design:type", String)
], CreateCommercialOfferDto.prototype, "rightsOpeningProcedure", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], CreateCommercialOfferDto.prototype, "remunerationKztNet", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(4000),
    __metadata("design:type", String)
], CreateCommercialOfferDto.prototype, "sequelFranchiseTerms", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(4000),
    __metadata("design:type", String)
], CreateCommercialOfferDto.prototype, "paymentSchedule", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(365),
    __metadata("design:type", Number)
], CreateCommercialOfferDto.prototype, "offerValidityDays", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], CreateCommercialOfferDto.prototype, "signatoryPlaceholder", void 0);
//# sourceMappingURL=create-commercial-offer.dto.js.map