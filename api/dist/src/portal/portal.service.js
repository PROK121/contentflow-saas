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
exports.PortalService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
let PortalService = class PortalService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async rightsOwnerSummary(rightsHolderOrgId) {
        const contentCount = await this.prisma.catalogItem.count({
            where: { rightsHolderOrgId },
        });
        const activeLicensesCount = await this.prisma.contract.count({
            where: {
                status: client_1.ContractStatus.signed,
                termEndAt: { gt: new Date() },
                deal: {
                    catalogItems: {
                        some: { catalogItem: { rightsHolderOrgId } },
                    },
                },
            },
        });
        const payoutSum = await this.prisma.payout.aggregate({
            where: { rightsHolderOrgId },
            _sum: { amountNet: true },
        });
        const pendingPayoutsTotal = payoutSum._sum.amountNet?.toString() ?? '0';
        const items = await this.prisma.catalogItem.findMany({
            where: { rightsHolderOrgId },
            take: 50,
            include: {
                licenseTerms: true,
                deals: {
                    include: {
                        deal: true,
                    },
                },
            },
        });
        const portalItems = items.map((item) => ({
            catalogItemId: item.id,
            title: item.title,
            soldRegions: item.licenseTerms.map((t) => t.territoryCode),
            lastDealAmount: item.deals[0]?.deal?.commercialSnapshot
                ? String(item.deals[0].deal.commercialSnapshot
                    ?.amount ?? '')
                : undefined,
            lastPayoutStatus: undefined,
        }));
        return {
            contentCount,
            activeLicensesCount,
            pendingPayoutsTotal: pending.length === 0 ? '0' : pendingPayoutsTotal,
            items: portalItems,
        };
    }
};
exports.PortalService = PortalService;
exports.PortalService = PortalService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PortalService);
//# sourceMappingURL=portal.service.js.map