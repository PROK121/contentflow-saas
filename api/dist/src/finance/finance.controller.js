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
exports.FinanceController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const update_payment_dto_1 = require("./dto/update-payment.dto");
const finance_service_1 = require("./finance.service");
let FinanceController = class FinanceController {
    constructor(financeService) {
        this.financeService = financeService;
    }
    paymentStats() {
        return this.financeService.paymentStats();
    }
    listPayments(direction, status, dealId, from, to, q, dealKind) {
        const dir = direction === client_1.PaymentDirection.inbound ||
            direction === client_1.PaymentDirection.outbound
            ? direction
            : undefined;
        const st = status && Object.values(client_1.PaymentStatus).includes(status)
            ? status
            : undefined;
        const dk = dealKind === client_1.DealKind.sale || dealKind === client_1.DealKind.purchase
            ? dealKind
            : undefined;
        return this.financeService.listPayments({
            direction: dir,
            status: st,
            dealId,
            from,
            to,
            q,
            dealKind: dk,
        });
    }
    updatePayment(id, dto) {
        return this.financeService.updatePayment(id, dto);
    }
    payouts() {
        return this.financeService.listPayouts();
    }
};
exports.FinanceController = FinanceController;
__decorate([
    (0, common_1.Get)('payments/stats'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], FinanceController.prototype, "paymentStats", null);
__decorate([
    (0, common_1.Get)('payments'),
    __param(0, (0, common_1.Query)('direction')),
    __param(1, (0, common_1.Query)('status')),
    __param(2, (0, common_1.Query)('dealId')),
    __param(3, (0, common_1.Query)('from')),
    __param(4, (0, common_1.Query)('to')),
    __param(5, (0, common_1.Query)('q')),
    __param(6, (0, common_1.Query)('dealKind')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String, String, String]),
    __metadata("design:returntype", void 0)
], FinanceController.prototype, "listPayments", null);
__decorate([
    (0, common_1.Patch)('payments/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_payment_dto_1.UpdatePaymentDto]),
    __metadata("design:returntype", void 0)
], FinanceController.prototype, "updatePayment", null);
__decorate([
    (0, common_1.Get)('payouts'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], FinanceController.prototype, "payouts", null);
exports.FinanceController = FinanceController = __decorate([
    (0, common_1.Controller)('finance'),
    __metadata("design:paramtypes", [finance_service_1.FinanceService])
], FinanceController);
//# sourceMappingURL=finance.controller.js.map