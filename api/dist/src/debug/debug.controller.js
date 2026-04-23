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
exports.DebugController = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let DebugController = class DebugController {
    constructor(prisma) {
        this.prisma = prisma;
    }
    ping() {
        return {
            ok: true,
            service: 'contentflow-api',
            hint: 'Если вы видите это из браузера по :3000/v1/debug/ping — это Nest, не Next.',
        };
    }
    async db() {
        try {
            await this.prisma.$queryRaw `SELECT 1`;
            return { ok: true, database: 'reachable' };
        }
        catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            return {
                ok: false,
                database: 'unreachable',
                message,
                hint: 'Проверьте DATABASE_URL, docker compose up -d, prisma migrate deploy.',
            };
        }
    }
};
exports.DebugController = DebugController;
__decorate([
    (0, common_1.Get)('ping'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], DebugController.prototype, "ping", null);
__decorate([
    (0, common_1.Get)('db'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], DebugController.prototype, "db", null);
exports.DebugController = DebugController = __decorate([
    (0, common_1.Controller)('debug'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], DebugController);
//# sourceMappingURL=debug.controller.js.map