"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GlobalExceptionFilter = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
function getErrorMessage(exception) {
    if (exception instanceof client_1.Prisma.PrismaClientKnownRequestError) {
        return `[Prisma ${exception.code}] ${exception.message}`;
    }
    if (exception instanceof client_1.Prisma.PrismaClientInitializationError) {
        return `[Prisma] База недоступна: ${exception.message}. Проверьте DATABASE_URL и что Postgres запущен (docker compose up -d).`;
    }
    if (exception instanceof client_1.Prisma.PrismaClientUnknownRequestError) {
        return `[Prisma] ${exception.message}`;
    }
    if (exception instanceof client_1.Prisma.PrismaClientRustPanicError) {
        return `[Prisma engine] ${exception.message}`;
    }
    if (exception instanceof Error) {
        return exception.message;
    }
    if (typeof exception === 'string') {
        return exception;
    }
    try {
        return JSON.stringify(exception);
    }
    catch {
        return 'Unknown error';
    }
}
let GlobalExceptionFilter = class GlobalExceptionFilter {
    catch(exception, host) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse();
        const request = ctx.getRequest();
        if (exception instanceof common_1.HttpException) {
            const status = exception.getStatus();
            const body = exception.getResponse();
            response
                .status(status)
                .json(typeof body === 'object' && body !== null
                ? body
                : { statusCode: status, message: body });
            return;
        }
        const message = getErrorMessage(exception);
        console.error('[API]', request.method, request.url, exception instanceof Error ? exception.stack : exception);
        response.status(common_1.HttpStatus.INTERNAL_SERVER_ERROR).json({
            statusCode: common_1.HttpStatus.INTERNAL_SERVER_ERROR,
            message,
            path: request.url,
            error: 'Internal Server Error',
        });
    }
};
exports.GlobalExceptionFilter = GlobalExceptionFilter;
exports.GlobalExceptionFilter = GlobalExceptionFilter = __decorate([
    (0, common_1.Catch)()
], GlobalExceptionFilter);
//# sourceMappingURL=http-exception.filter.js.map