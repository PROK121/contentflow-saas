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
exports.CommercialOffersService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path = __importStar(require("path"));
const prisma_service_1 = require("../prisma/prisma.service");
const create_commercial_offer_dto_1 = require("./dto/create-commercial-offer.dto");
const offer_template_engine_1 = require("./offer-template.engine");
function uploadRoot() {
    return process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'uploads');
}
let CommercialOffersService = class CommercialOffersService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    findAll(filters) {
        const archivedOnly = filters?.archivedOnly === true;
        const signedOnly = filters?.signedOnly === true;
        const where = {};
        if (signedOnly) {
            where.clientSigned = true;
            where.archived = false;
        }
        else if (archivedOnly) {
            where.archived = true;
        }
        else {
            where.archived = false;
            where.clientSigned = false;
        }
        return this.prisma.commercialOffer
            .findMany({
            where,
            orderBy: signedOnly
                ? [{ signedAt: 'desc' }, { createdAt: 'desc' }]
                : { createdAt: 'desc' },
            select: {
                id: true,
                title: true,
                storageKey: true,
                archived: true,
                clientSigned: true,
                signedAt: true,
                sourceOfferId: true,
                createdAt: true,
                updatedAt: true,
                payload: true,
            },
        })
            .then((rows) => rows.map((row) => {
            const p = row.payload;
            const clientLegalName = typeof p?.clientLegalName === 'string'
                ? p.clientLegalName
                : undefined;
            const templateKindRaw = p?.templateKind;
            const templateKind = templateKindRaw === create_commercial_offer_dto_1.OfferTemplateKindDto.platforms
                ? create_commercial_offer_dto_1.OfferTemplateKindDto.platforms
                : create_commercial_offer_dto_1.OfferTemplateKindDto.po;
            return {
                id: row.id,
                title: row.title,
                storageKey: row.storageKey,
                archived: row.archived,
                clientSigned: row.clientSigned,
                signedAt: row.signedAt,
                sourceOfferId: row.sourceOfferId,
                createdAt: row.createdAt,
                updatedAt: row.updatedAt,
                clientLegalName,
                templateKind,
            };
        }));
    }
    async setArchived(id, archived) {
        const row = await this.prisma.commercialOffer.update({
            where: { id },
            data: { archived },
            select: {
                id: true,
                title: true,
                archived: true,
                updatedAt: true,
            },
        });
        return row;
    }
    async remove(id) {
        const row = await this.prisma.commercialOffer.findUnique({ where: { id } });
        if (!row)
            throw new common_1.NotFoundException();
        if (!row.archived) {
            throw new common_1.BadRequestException('Удалить можно только оффер из архива');
        }
        const abs = path.join(uploadRoot(), row.storageKey);
        await this.prisma.commercialOffer.delete({ where: { id } });
        try {
            (0, fs_1.unlinkSync)(abs);
        }
        catch {
        }
        return { ok: true, id };
    }
    async assertBuyerOrgHasDeals(buyerOrgId) {
        const deal = await this.prisma.deal.findFirst({
            where: { buyerOrgId, archived: false },
            include: { buyer: true },
        });
        if (!deal?.buyer) {
            throw new common_1.BadRequestException('Клиент не найден или по нему нет ни одной сделки');
        }
        return { legalName: deal.buyer.legalName };
    }
    async create(dto) {
        const { legalName: clientLegalName } = await this.assertBuyerOrgHasDeals(dto.buyerOrgId);
        const variant = dto.templateKind === create_commercial_offer_dto_1.OfferTemplateKindDto.platforms ? 'platforms' : 'po';
        const templateKindStored = variant === 'platforms'
            ? create_commercial_offer_dto_1.OfferTemplateKindDto.platforms
            : create_commercial_offer_dto_1.OfferTemplateKindDto.po;
        const payloadForStore = {
            ...dto,
            clientLegalName,
            templateKind: templateKindStored,
        };
        let buf;
        try {
            buf = await (0, offer_template_engine_1.renderOfferPdfFromDto)(dto, variant);
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            throw new common_1.ServiceUnavailableException(`Не удалось сформировать PDF оффера. ${msg}`);
        }
        const id = (0, crypto_1.randomUUID)();
        const storageKey = path.join('commercial-offers', `${id}.pdf`);
        const abs = path.join(uploadRoot(), storageKey);
        (0, fs_1.mkdirSync)(path.dirname(abs), { recursive: true });
        await (0, promises_1.writeFile)(abs, buf);
        const row = await this.prisma.commercialOffer.create({
            data: {
                id,
                title: dto.workTitle,
                payload: JSON.parse(JSON.stringify(payloadForStore)),
                storageKey,
                clientSigned: false,
            },
        });
        return {
            id: row.id,
            title: row.title,
            storageKey,
            createdAt: row.createdAt,
        };
    }
    async getDocumentStream(id) {
        const row = await this.prisma.commercialOffer.findUnique({
            where: { id },
        });
        if (!row?.storageKey)
            return null;
        const abs = path.join(uploadRoot(), row.storageKey);
        const stream = (0, fs_1.createReadStream)(abs);
        const safe = row.title
            .replace(/[^\w\u0400-\u04FF\s-]+/g, '')
            .trim()
            .slice(0, 80) || 'offer';
        return {
            stream,
            fileName: `${safe}-${id.slice(0, 8)}.pdf`,
        };
    }
    async findById(id) {
        const row = await this.prisma.commercialOffer.findUnique({
            where: { id },
            select: {
                id: true,
                title: true,
                storageKey: true,
                archived: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        if (!row)
            throw new common_1.NotFoundException();
        return row;
    }
};
exports.CommercialOffersService = CommercialOffersService;
exports.CommercialOffersService = CommercialOffersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], CommercialOffersService);
//# sourceMappingURL=commercial-offers.service.js.map