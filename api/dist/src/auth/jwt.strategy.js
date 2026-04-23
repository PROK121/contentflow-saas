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
exports.JwtStrategy = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const passport_1 = require("@nestjs/passport");
const passport_jwt_1 = require("passport-jwt");
const prisma_service_1 = require("../prisma/prisma.service");
const safeUserSelect = {
    id: true,
    email: true,
    role: true,
    displayName: true,
    organizationId: true,
    locale: true,
    createdAt: true,
    updatedAt: true,
};
function jwtFromRequest(req) {
    const fromCookie = req?.cookies?.['cf_session'];
    if (typeof fromCookie === 'string' && fromCookie.length > 0)
        return fromCookie;
    return passport_jwt_1.ExtractJwt.fromAuthHeaderAsBearerToken()(req);
}
let JwtStrategy = class JwtStrategy extends (0, passport_1.PassportStrategy)(passport_jwt_1.Strategy, 'jwt') {
    constructor(config, prisma) {
        super({
            jwtFromRequest,
            ignoreExpiration: false,
            secretOrKey: config.get('JWT_SECRET') ?? 'dev-change-me',
        });
        this.prisma = prisma;
    }
    async validate(payload) {
        const id = payload.sub;
        if (!id)
            throw new common_1.UnauthorizedException();
        const user = await this.prisma.user.findUnique({
            where: { id },
            select: safeUserSelect,
        });
        if (!user)
            throw new common_1.UnauthorizedException();
        return user;
    }
};
exports.JwtStrategy = JwtStrategy;
exports.JwtStrategy = JwtStrategy = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        prisma_service_1.PrismaService])
], JwtStrategy);
//# sourceMappingURL=jwt.strategy.js.map