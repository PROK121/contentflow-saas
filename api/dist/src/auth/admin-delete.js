"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAdminDeleteEmail = getAdminDeleteEmail;
exports.assertAdminDeleteUser = assertAdminDeleteUser;
const common_1 = require("@nestjs/common");
function getAdminDeleteEmail() {
    return (process.env.ADMIN_DELETE_EMAIL?.trim().toLowerCase() ||
        'info@growixcontent.com');
}
function assertAdminDeleteUser(user) {
    if (!user?.email) {
        throw new common_1.ForbiddenException('Доступ запрещён');
    }
    const allowed = getAdminDeleteEmail();
    if (user.email.trim().toLowerCase() !== allowed) {
        throw new common_1.ForbiddenException('Безвозвратное удаление доступно только администратору');
    }
}
//# sourceMappingURL=admin-delete.js.map