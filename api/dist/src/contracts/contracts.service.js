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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContractsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const path = __importStar(require("path"));
const PDFDocument = require("pdfkit");
const prisma_service_1 = require("../prisma/prisma.service");
const library_1 = require("@prisma/client/runtime/library");
function contractsUploadRoot() {
    return process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'uploads');
}
const DEFAULT_TEMPLATE_ID = 'default-template';
let ContractsService = class ContractsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    findAll(filters) {
        const where = {};
        const signedOnly = filters?.signedOnly === true;
        const archivedOnly = filters?.archivedOnly === true;
        if (signedOnly) {
            where.clientCabinetSigned = true;
            where.archived = false;
        }
        else if (archivedOnly) {
            where.archived = true;
        }
        else {
            where.archived = false;
            where.clientCabinetSigned = false;
        }
        if (filters?.q?.trim()) {
            const q = filters.q.trim();
            where.OR = [
                { number: { contains: q, mode: 'insensitive' } },
                { deal: { title: { contains: q, mode: 'insensitive' } } },
                {
                    deal: {
                        buyer: { legalName: { contains: q, mode: 'insensitive' } },
                    },
                },
            ];
        }
        const take = filters?.take != null
            ? Math.min(200, Math.max(1, Math.floor(filters.take)))
            : undefined;
        return this.prisma.contract.findMany({
            where,
            ...(take != null ? { take } : {}),
            orderBy: signedOnly
                ? [{ cabinetSignedAt: 'desc' }, { updatedAt: 'desc' }]
                : { updatedAt: 'desc' },
            include: {
                deal: { include: { buyer: { select: { id: true, legalName: true } } } },
            },
        });
    }
    async updateArchived(id, archived) {
        const exists = await this.prisma.contract.findUnique({
            where: { id },
            select: { id: true },
        });
        if (!exists)
            throw new common_1.NotFoundException();
        return this.prisma.contract.update({
            where: { id },
            data: { archived },
            include: {
                deal: { include: { buyer: { select: { id: true, legalName: true } } } },
            },
        });
    }
    findById(id) {
        return this.prisma.contract.findUnique({
            where: { id },
            include: {
                deal: {
                    include: {
                        buyer: true,
                        catalogItems: { include: { catalogItem: true } },
                    },
                },
            },
        });
    }
    async getVersionFileForDownload(contractId, versionNum) {
        if (!Number.isInteger(versionNum) || versionNum < 1) {
            throw new common_1.NotFoundException('Invalid version');
        }
        const ver = await this.prisma.contractVersion.findFirst({
            where: { contractId, version: versionNum },
        });
        if (!ver)
            throw new common_1.NotFoundException('Version not found');
        const contract = await this.prisma.contract.findUnique({
            where: { id: contractId },
            select: { id: true, number: true },
        });
        if (!contract)
            throw new common_1.NotFoundException();
        const abs = path.join(contractsUploadRoot(), ver.storageKey);
        const dir = path.dirname(abs);
        if (!(0, fs_1.existsSync)(dir)) {
            (0, fs_1.mkdirSync)(dir, { recursive: true });
        }
        if (!(0, fs_1.existsSync)(abs)) {
            await this.writeContractPlaceholderPdf(abs, contract.number, versionNum);
        }
        const stream = (0, fs_1.createReadStream)(abs);
        const safeNum = contract.number.replace(/[/\\?%*:|"<>]/g, '_').slice(0, 80);
        const fileName = `${safeNum}-v${versionNum}.pdf`;
        return { stream, fileName };
    }
    writeContractPlaceholderPdf(absPath, contractNumber, version) {
        return new Promise((resolve, reject) => {
            const doc = new PDFDocument({ size: 'A4', margin: 50 });
            const w = (0, fs_1.createWriteStream)(absPath);
            doc.pipe(w);
            doc.fontSize(18).text(`Контракт ${contractNumber}`, { align: 'center' });
            doc.moveDown();
            doc.fontSize(12).text(`Версия документа: ${version}`, { align: 'left' });
            doc.moveDown(0.5);
            doc
                .fontSize(10)
                .text('Авто-сгенерированный PDF. При работе с реальными файлами замените документ в хранилище (storageKey).', { align: 'left' });
            doc.end();
            w.on('finish', () => resolve());
            w.on('error', reject);
        });
    }
    buildDealSnapshotFingerprint(deal) {
        const payload = JSON.stringify({
            title: deal.title,
            buyerOrgId: deal.buyerOrgId,
            currency: deal.currency,
            commercialSnapshot: deal.commercialSnapshot,
            lines: deal.catalogItems.map((l) => ({
                catalogItemId: l.catalogItemId,
                rights: l.rightsSelection,
            })),
        });
        return (0, crypto_1.createHash)('sha256').update(payload).digest('hex').slice(0, 40);
    }
    async createDraft(dto) {
        const deal = await this.prisma.deal.findUnique({
            where: { id: dto.dealId },
            include: { catalogItems: true },
        });
        if (!deal)
            throw new common_1.NotFoundException('Deal not found');
        const templateId = dto.templateId ?? DEFAULT_TEMPLATE_ID;
        const snap = deal.commercialSnapshot ?? {};
        const amountStr = typeof snap.expectedValue === 'string' ||
            typeof snap.expectedValue === 'number'
            ? String(snap.expectedValue)
            : '0';
        const termEnd = new Date();
        termEnd.setFullYear(termEnd.getFullYear() + 1);
        const rightsPayload = {
            dealId: deal.id,
            catalogLines: deal.catalogItems.map((l) => ({
                catalogItemId: l.catalogItemId,
                rightsSelection: l.rightsSelection,
            })),
            templateId,
        };
        const fingerprint = this.buildDealSnapshotFingerprint(deal);
        const number = `CF-${Date.now()}`;
        const contract = await this.prisma.contract.create({
            data: {
                dealId: deal.id,
                number,
                status: client_1.ContractStatus.draft,
                territory: 'MULTI',
                termEndAt: termEnd,
                amount: new library_1.Decimal(amountStr || '0'),
                currency: deal.currency,
                rightsPayload,
                templateId,
                dealSnapshotFingerprint: fingerprint,
                clientCabinetSigned: false,
            },
            include: { deal: true },
        });
        await this.prisma.contractVersion.create({
            data: {
                contractId: contract.id,
                version: 1,
                storageKey: `contracts/${contract.id}/v1.pdf`,
                sha256: (0, crypto_1.createHash)('sha256')
                    .update(`draft-${contract.id}-v1`)
                    .digest('hex'),
                templateId,
            },
        });
        return contract;
    }
    async markSent(contractId, signingDueAt) {
        const c = await this.prisma.contract.findUnique({
            where: { id: contractId },
            include: { deal: true },
        });
        if (!c)
            throw new common_1.NotFoundException();
        const due = signingDueAt ? new Date(signingDueAt) : undefined;
        const updated = await this.prisma.contract.update({
            where: { id: contractId },
            data: {
                status: client_1.ContractStatus.sent,
                signingDueAt: due ?? c.signingDueAt,
            },
        });
        await this.prisma.task.create({
            data: {
                assigneeId: c.deal.ownerUserId,
                dueAt: due ?? new Date(Date.now() + 7 * 86400000),
                type: client_1.TaskType.custom,
                status: client_1.TaskStatus.todo,
                priority: client_1.TaskPriority.high,
                linkedEntityType: 'contract',
                linkedEntityId: contractId,
                title: 'Напоминание: контракт не подписан клиентом',
            },
        });
        return updated;
    }
    async markSigned(contractId) {
        const c = await this.prisma.contract.findUnique({
            where: { id: contractId },
        });
        if (!c)
            throw new common_1.NotFoundException();
        const updated = await this.prisma.contract.update({
            where: { id: contractId },
            data: { status: client_1.ContractStatus.signed },
        });
        await this.prisma.task.updateMany({
            where: {
                linkedEntityType: 'contract',
                linkedEntityId: contractId,
                title: 'Напоминание: контракт не подписан клиентом',
                status: { not: client_1.TaskStatus.done },
            },
            data: { status: client_1.TaskStatus.done },
        });
        return updated;
    }
    async markExpiredDraft(contractId) {
        const c = await this.prisma.contract.findUnique({
            where: { id: contractId },
        });
        if (!c)
            throw new common_1.NotFoundException();
        return this.prisma.contract.update({
            where: { id: contractId },
            data: { status: client_1.ContractStatus.expired },
        });
    }
    async compareWithDeal(contractId) {
        const c = await this.findById(contractId);
        if (!c)
            throw new common_1.NotFoundException();
        const deal = c.deal;
        if (!deal)
            throw new common_1.NotFoundException();
        const currentFp = this.buildDealSnapshotFingerprint({
            title: deal.title,
            buyerOrgId: deal.buyerOrgId,
            currency: deal.currency,
            commercialSnapshot: deal.commercialSnapshot,
            catalogItems: deal.catalogItems,
        });
        const fingerprintDiffers = !!c.dealSnapshotFingerprint && c.dealSnapshotFingerprint !== currentFp;
        const differences = [];
        const snap = deal.commercialSnapshot ?? {};
        const ev = snap.expectedValue;
        const evRaw = ev !== undefined && ev !== null && String(ev).trim() !== ''
            ? String(ev)
            : null;
        const contractAmtStr = new library_1.Decimal(c.amount).toFixed(2);
        if (evRaw !== null) {
            const a = parseFloat(String(evRaw).replace(/\s/g, '').replace(',', '.'));
            const b = parseFloat(contractAmtStr);
            if (!Number.isNaN(a) && !Number.isNaN(b) && Math.abs(a - b) > 0.01) {
                differences.push(`Сумма: в сделке ожидается ${evRaw} ${deal.currency}, в контракте ${contractAmtStr} ${c.currency}`);
            }
        }
        if (deal.currency !== c.currency) {
            differences.push(`Валюта: сделка ${deal.currency}, контракт ${c.currency}`);
        }
        const sortLines = (rows) => JSON.stringify([...rows]
            .map((r) => ({
            catalogItemId: r.catalogItemId,
            rightsSelection: r.rightsSelection,
        }))
            .sort((x, y) => x.catalogItemId.localeCompare(y.catalogItemId)));
        const dealSorted = sortLines(deal.catalogItems);
        const payload = c.rightsPayload;
        const rawLines = Array.isArray(payload?.catalogLines)
            ? payload.catalogLines
            : [];
        const contractRows = rawLines.map((line) => {
            const l = line;
            return {
                catalogItemId: l.catalogItemId ?? '',
                rightsSelection: l.rightsSelection ?? null,
            };
        });
        const contractSorted = JSON.stringify([...contractRows].sort((x, y) => x.catalogItemId.localeCompare(y.catalogItemId)));
        if (dealSorted !== contractSorted) {
            differences.push('Состав контента или параметры прав в сделке не совпадают со снимком в контракте');
        }
        const differs = fingerprintDiffers || differences.length > 0;
        return {
            differs,
            differences,
            contractFingerprint: c.dealSnapshotFingerprint,
            dealFingerprint: currentFp,
            message: differs
                ? differences.length > 0
                    ? 'Обнаружены расхождения между сделкой и контрактом'
                    : 'Данные сделки изменились после генерации контракта'
                : 'Данные сделки совпадают со снимком контракта',
        };
    }
    async addManualVersion(contractId, note) {
        const c = await this.prisma.contract.findUnique({
            where: { id: contractId },
        });
        if (!c)
            throw new common_1.NotFoundException();
        const last = await this.prisma.contractVersion.findFirst({
            where: { contractId },
            orderBy: { version: 'desc' },
        });
        const nextV = (last?.version ?? 0) + 1;
        const templateId = c.templateId ?? DEFAULT_TEMPLATE_ID;
        const v = await this.prisma.contractVersion.create({
            data: {
                contractId,
                version: nextV,
                storageKey: `contracts/${contractId}/v${nextV}-manual.pdf`,
                sha256: (0, crypto_1.createHash)('sha256')
                    .update(`manual-${contractId}-v${nextV}-${note ?? ''}`)
                    .digest('hex'),
                templateId,
            },
        });
        return { version: v, note: note ?? 'Manual edit saved as new version' };
    }
    versions(contractId) {
        return this.prisma.contractVersion.findMany({
            where: { contractId },
            orderBy: { version: 'desc' },
        });
    }
    async removeContract(contractId) {
        const c = await this.prisma.contract.findUnique({
            where: { id: contractId },
        });
        if (!c)
            throw new common_1.NotFoundException();
        if (!c.archived) {
            throw new common_1.BadRequestException('Удалить можно только архивный контракт');
        }
        await this.prisma.$transaction(async (tx) => {
            await tx.task.deleteMany({
                where: {
                    linkedEntityType: 'contract',
                    linkedEntityId: contractId,
                },
            });
            await tx.payout.deleteMany({ where: { contractId } });
            await tx.royaltyLine.deleteMany({ where: { contractId } });
            await tx.contractVersion.deleteMany({ where: { contractId } });
            await tx.payment.deleteMany({ where: { contractId } });
            await tx.contract.delete({ where: { id: contractId } });
        });
        return { ok: true, id: contractId };
    }
};
exports.ContractsService = ContractsService;
exports.ContractsService = ContractsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ContractsService);
//# sourceMappingURL=contracts.service.js.map