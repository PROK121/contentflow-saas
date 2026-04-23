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
exports.TasksController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const admin_delete_1 = require("../auth/admin-delete");
const create_task_dto_1 = require("./dto/create-task.dto");
const create_task_comment_dto_1 = require("./dto/create-task-comment.dto");
const update_task_dto_1 = require("./dto/update-task.dto");
const tasks_service_1 = require("./tasks.service");
let TasksController = class TasksController {
    constructor(tasksService) {
        this.tasksService = tasksService;
    }
    list(assigneeId, status, priority, type, overdue, archivedOnly, q, limit, skip) {
        const filters = {};
        if (archivedOnly === 'true' ||
            archivedOnly === '1' ||
            archivedOnly === 'yes') {
            filters.archivedOnly = true;
        }
        if (assigneeId?.trim())
            filters.assigneeId = assigneeId.trim();
        if (q?.trim())
            filters.q = q.trim();
        const lim = limit != null && limit !== '' ? Number.parseInt(limit, 10) : NaN;
        const sk = skip != null && skip !== '' ? Number.parseInt(skip, 10) : NaN;
        if (Number.isFinite(lim)) {
            filters.take = lim;
            filters.skip = Number.isFinite(sk) ? Math.max(0, sk) : 0;
        }
        if (status && Object.values(client_1.TaskStatus).includes(status)) {
            filters.status = status;
        }
        if (priority &&
            Object.values(client_1.TaskPriority).includes(priority)) {
            filters.priority = priority;
        }
        if (type && Object.values(client_1.TaskType).includes(type)) {
            filters.type = type;
        }
        if (overdue === 'true' || overdue === '1') {
            filters.overdue = true;
        }
        return this.tasksService.findAll(filters);
    }
    create(body) {
        return this.tasksService.create(body);
    }
    listComments(id) {
        return this.tasksService.listComments(id);
    }
    addComment(id, req, body) {
        const user = req.user;
        return this.tasksService.addComment(id, user.id, body);
    }
    patch(id, body) {
        return this.tasksService.update(id, body);
    }
    remove(id, req) {
        (0, admin_delete_1.assertAdminDeleteUser)(req.user);
        return this.tasksService.remove(id);
    }
};
exports.TasksController = TasksController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('assigneeId')),
    __param(1, (0, common_1.Query)('status')),
    __param(2, (0, common_1.Query)('priority')),
    __param(3, (0, common_1.Query)('type')),
    __param(4, (0, common_1.Query)('overdue')),
    __param(5, (0, common_1.Query)('archivedOnly')),
    __param(6, (0, common_1.Query)('q')),
    __param(7, (0, common_1.Query)('limit')),
    __param(8, (0, common_1.Query)('skip')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String, String, String, String, String]),
    __metadata("design:returntype", void 0)
], TasksController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_task_dto_1.CreateTaskDto]),
    __metadata("design:returntype", void 0)
], TasksController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(':id/comments'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], TasksController.prototype, "listComments", null);
__decorate([
    (0, common_1.Post)(':id/comments'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, create_task_comment_dto_1.CreateTaskCommentDto]),
    __metadata("design:returntype", void 0)
], TasksController.prototype, "addComment", null);
__decorate([
    (0, common_1.Patch)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_task_dto_1.UpdateTaskDto]),
    __metadata("design:returntype", void 0)
], TasksController.prototype, "patch", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], TasksController.prototype, "remove", null);
exports.TasksController = TasksController = __decorate([
    (0, common_1.Controller)('tasks'),
    __metadata("design:paramtypes", [tasks_service_1.TasksService])
], TasksController);
//# sourceMappingURL=tasks.controller.js.map