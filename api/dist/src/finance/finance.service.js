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
exports.FinanceService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
function decStr(d) {
    if (d == null)
        return null;
    return d.toString();
}
let FinanceService = class FinanceService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async listPayouts() {
        const rows = await this.prisma.payout.findMany({
            orderBy: { createdAt: 'desc' },
            take: 500,
            include: {
                rightsHolder: true,
                contract: {
                    include: {
                        deal: { select: { id: true, title: true } },
                    },
                },
            },
        });
        return rows.map((r) => ({
            id: r.id,
            royaltyLineId: r.royaltyLineId,
            contractId: r.contractId,
            rightsHolderOrgId: r.rightsHolderOrgId,
            amountGross: r.amountGross.toString(),
            withholdingTaxAmount: r.withholdingTaxAmount.toString(),
            amountNet: r.amountNet.toString(),
            currency: r.currency,
            taxProfileSnapshotId: r.taxProfileSnapshotId,
            createdAt: r.createdAt.toISOString(),
            updatedAt: r.updatedAt.toISOString(),
            rightsHolder: {
                id: r.rightsHolder.id,
                legalName: r.rightsHolder.legalName,
                country: r.rightsHolder.country,
            },
            contract: {
                id: r.contract.id,
                number: r.contract.number,
                currency: r.contract.currency,
                amount: r.contract.amount.toString(),
                deal: r.contract.deal,
            },
        }));
    }
    async updatePayment(id, dto) {
        const exists = await this.prisma.payment.findUnique({
            where: { id },
            select: { id: true },
        });
        if (!exists)
            throw new common_1.NotFoundException();
        const data = {};
        if (dto.status !== undefined) {
            data.status = dto.status;
        }
        if (dto.paidAt !== undefined) {
            const d = new Date(dto.paidAt);
            if (Number.isNaN(d.getTime())) {
                throw new common_1.BadRequestException('Invalid paidAt');
            }
            data.paidAt = d;
        }
        else if (dto.status === client_1.PaymentStatus.paid && dto.paidAtClear !== true) {
            data.paidAt = new Date();
        }
        if (dto.paidAtClear === true) {
            data.paidAt = null;
        }
        const row = await this.prisma.payment.update({
            where: { id },
            data,
            include: {
                deal: { include: { buyer: true } },
                contract: true,
            },
        });
        return this.serializePayment(row);
    }
    serializePayment(row) {
        return {
            id: row.id,
            dealId: row.dealId,
            contractId: row.contractId,
            direction: row.direction,
            amount: row.amount.toString(),
            currency: row.currency,
            withholdingTaxAmount: decStr(row.withholdingTaxAmount),
            netAmount: decStr(row.netAmount),
            dueAt: row.dueAt?.toISOString() ?? null,
            paidAt: row.paidAt?.toISOString() ?? null,
            status: row.status,
            createdAt: row.createdAt.toISOString(),
            updatedAt: row.updatedAt.toISOString(),
            deal: row.deal
                ? {
                    id: row.deal.id,
                    title: row.deal.title,
                    kind: row.deal.kind,
                    currency: row.deal.currency,
                    buyer: row.deal.buyer,
                }
                : null,
            contract: row.contract
                ? { id: row.contract.id, number: row.contract.number }
                : null,
        };
    }
    async listPayments(filters) {
        const where = {};
        if (filters.direction) {
            where.direction = filters.direction;
        }
        if (filters.status) {
            where.status = filters.status;
        }
        if (filters.dealId?.trim()) {
            where.dealId = filters.dealId.trim();
        }
        if (filters.dealKind) {
            where.deal = { is: { kind: filters.dealKind } };
        }
        if (filters.from || filters.to) {
            const dueFilter = {};
            if (filters.from) {
                const d = new Date(filters.from);
                if (!Number.isNaN(d.getTime()))
                    dueFilter.gte = d;
            }
            if (filters.to) {
                const d = new Date(filters.to);
                if (!Number.isNaN(d.getTime()))
                    dueFilter.lte = d;
            }
            if (Object.keys(dueFilter).length)
                where.dueAt = dueFilter;
        }
        if (filters.q?.trim()) {
            const q = filters.q.trim();
            where.OR = [
                { deal: { title: { contains: q, mode: 'insensitive' } } },
                {
                    deal: { buyer: { legalName: { contains: q, mode: 'insensitive' } } },
                },
                { contract: { number: { contains: q, mode: 'insensitive' } } },
            ];
        }
        const rows = await this.prisma.payment.findMany({
            where,
            orderBy: [{ dueAt: 'desc' }, { createdAt: 'desc' }],
            take: 500,
            include: {
                deal: { include: { buyer: true } },
                contract: true,
            },
        });
        return rows.map((r) => this.serializePayment(r));
    }
    async paymentStats() {
        const now = new Date();
        const inboundPaid = await this.prisma.payment.aggregate({
            where: {
                direction: client_1.PaymentDirection.inbound,
                status: { in: [client_1.PaymentStatus.paid, client_1.PaymentStatus.partially_paid] },
            },
            _sum: { amount: true },
            _count: true,
        });
        const inboundPending = await this.prisma.payment.aggregate({
            where: {
                direction: client_1.PaymentDirection.inbound,
                status: client_1.PaymentStatus.pending,
                OR: [{ dueAt: null }, { dueAt: { gte: now } }],
            },
            _sum: { amount: true },
            _count: true,
        });
        const inboundOverdue = await this.prisma.payment.aggregate({
            where: {
                direction: client_1.PaymentDirection.inbound,
                OR: [
                    { status: client_1.PaymentStatus.overdue },
                    {
                        status: client_1.PaymentStatus.pending,
                        dueAt: { lt: now },
                    },
                ],
            },
            _sum: { amount: true },
            _count: true,
        });
        const outboundOverdue = await this.prisma.payment.aggregate({
            where: {
                direction: client_1.PaymentDirection.outbound,
                OR: [
                    { status: client_1.PaymentStatus.overdue },
                    {
                        status: client_1.PaymentStatus.pending,
                        dueAt: { lt: now },
                    },
                ],
            },
            _sum: { amount: true },
            _count: true,
        });
        const payoutSum = await this.prisma.payout.aggregate({
            _sum: { amountNet: true },
            _count: true,
        });
        const z = (d) => d != null && d.isFinite() ? d.toString() : '0';
        return {
            inboundPaidTotal: z(inboundPaid._sum.amount),
            inboundPaidCount: inboundPaid._count,
            inboundPendingTotal: z(inboundPending._sum.amount),
            inboundPendingCount: inboundPending._count,
            inboundOverdueTotal: z(inboundOverdue._sum.amount),
            inboundOverdueCount: inboundOverdue._count,
            outboundOverdueTotal: z(outboundOverdue._sum.amount),
            outboundOverdueCount: outboundOverdue._count,
            payoutsNetTotal: z(payoutSum._sum.amountNet),
            payoutsCount: payoutSum._count,
        };
    }
};
exports.FinanceService = FinanceService;
exports.FinanceService = FinanceService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], FinanceService);
//# sourceMappingURL=finance.service.js.map