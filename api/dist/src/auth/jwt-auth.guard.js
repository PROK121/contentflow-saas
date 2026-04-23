"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JwtAuthGuard = void 0;
const common_1 = require("@nestjs/common");
const passport_1 = require("@nestjs/passport");
function normalizePath(req) {
    const raw = req.originalUrl ?? req.url;
    return raw.split('?')[0] ?? '';
}
function isPublicRoute(path, method) {
    if (method === 'POST' && path.endsWith('/auth/login'))
        return true;
    if (method === 'GET' && path.endsWith('/health'))
        return true;
    if (method === 'GET' && path.includes('/debug/'))
        return true;
    return false;
}
let JwtAuthGuard = class JwtAuthGuard extends (0, passport_1.AuthGuard)('jwt') {
    canActivate(context) {
        if (process.env.DISABLE_API_AUTH === '1')
            return true;
        const req = context.switchToHttp().getRequest();
        const path = normalizePath(req);
        if (isPublicRoute(path, req.method))
            return true;
        return super.canActivate(context);
    }
};
exports.JwtAuthGuard = JwtAuthGuard;
exports.JwtAuthGuard = JwtAuthGuard = __decorate([
    (0, common_1.Injectable)()
], JwtAuthGuard);
//# sourceMappingURL=jwt-auth.guard.js.map