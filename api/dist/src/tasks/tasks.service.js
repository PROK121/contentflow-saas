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
exports.TasksService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
const create_task_dto_1 = require("./dto/create-task.dto");
let TasksService = class TasksService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAll(filters) {
        const where = {};
        const archivedOnly = filters?.archivedOnly === true;
        if (archivedOnly) {
            where.archived = true;
        }
        else {
            where.archived = false;
        }
        if (filters?.assigneeId?.trim()) {
            where.assigneeId = filters.assigneeId.trim();
        }
        if (filters?.status && !archivedOnly) {
            where.status = filters.status;
        }
        if (filters?.priority) {
            where.priority = filters.priority;
        }
        if (filters?.type) {
            where.type = filters.type;
        }
        if (filters?.overdue && !archivedOnly) {
            where.dueAt = { lt: new Date() };
            where.status = { not: client_1.TaskStatus.done };
        }
        if (filters?.q?.trim()) {
            const q = filters.q.trim();
            where.OR = [
                { title: { contains: q, mode: 'insensitive' } },
                { description: { contains: q, mode: 'insensitive' } },
            ];
        }
        const skip = filters?.skip != null ? Math.max(0, Math.floor(filters.skip)) : undefined;
        const takeRaw = filters?.take;
        const take = takeRaw != null
            ? Math.min(200, Math.max(1, Math.floor(takeRaw)))
            : undefined;
        const [total, rows] = await Promise.all([
            this.prisma.task.count({ where }),
            this.prisma.task.findMany({
                where,
                orderBy: archivedOnly ? { updatedAt: 'desc' } : { dueAt: 'asc' },
                include: { assignee: true },
                ...(skip != null ? { skip } : {}),
                ...(take != null ? { take } : {}),
            }),
        ]);
        const items = await this.enrichTasks(rows);
        return { items, total };
    }
    async enrichTasks(tasks) {
        const dealIds = [
            ...new Set(tasks
                .filter((t) => t.linkedEntityType === 'deal')
                .map((t) => t.linkedEntityId)),
        ];
        const contractIds = [
            ...new Set(tasks
                .filter((t) => t.linkedEntityType === 'contract')
                .map((t) => t.linkedEntityId)),
        ];
        const [deals, contracts] = await Promise.all([
            dealIds.length > 0
                ? this.prisma.deal.findMany({
                    where: { id: { in: dealIds } },
                    select: { id: true, title: true },
                })
                : [],
            contractIds.length > 0
                ? this.prisma.contract.findMany({
                    where: { id: { in: contractIds } },
                    select: { id: true, dealId: true, number: true },
                })
                : [],
        ]);
        const dealTitleById = new Map(deals.map((d) => [d.id, d.title]));
        const contractById = new Map(contracts.map((c) => [c.id, { dealId: c.dealId, number: c.number }]));
        return tasks.map((t) => {
            let primaryPath = null;
            let linkedLabel = null;
            if (t.linkedEntityType === 'deal') {
                primaryPath = `/deals/${t.linkedEntityId}`;
                linkedLabel = dealTitleById.get(t.linkedEntityId) ?? null;
            }
            else if (t.linkedEntityType === 'contract') {
                const c = contractById.get(t.linkedEntityId);
                if (c) {
                    primaryPath = `/deals/${c.dealId}`;
                    linkedLabel = c.number;
                }
            }
            return { ...t, primaryPath, linkedLabel };
        });
    }
    async create(dto) {
        const linkType = dto.linkedEntityType?.trim() || create_task_dto_1.TASK_LINK_NONE;
        const linkId = dto.linkedEntityId?.trim() || create_task_dto_1.TASK_LINK_NONE;
        if (linkType !== create_task_dto_1.TASK_LINK_NONE && (!linkId || linkId === create_task_dto_1.TASK_LINK_NONE)) {
            throw new common_1.BadRequestException('Укажите объект связи или выберите «Без привязки»');
        }
        if (linkType === create_task_dto_1.TASK_LINK_NONE &&
            linkId !== create_task_dto_1.TASK_LINK_NONE &&
            linkId.length > 0) {
            throw new common_1.BadRequestException('Несогласованная привязка задачи');
        }
        const task = await this.prisma.task.create({
            data: {
                assigneeId: dto.assigneeId,
                dueAt: new Date(dto.dueAt),
                type: dto.type ?? client_1.TaskType.custom,
                status: dto.status ?? client_1.TaskStatus.todo,
                priority: dto.priority ?? client_1.TaskPriority.medium,
                title: dto.title?.trim() || null,
                description: dto.description?.trim() || null,
                linkedEntityType: linkType,
                linkedEntityId: linkType === create_task_dto_1.TASK_LINK_NONE ? create_task_dto_1.TASK_LINK_NONE : linkId,
            },
            include: { assignee: true },
        });
        const [enriched] = await this.enrichTasks([task]);
        return enriched;
    }
    async update(id, dto) {
        const existing = await this.prisma.task.findUnique({ where: { id } });
        if (!existing)
            throw new common_1.NotFoundException();
        const data = {};
        if (dto.assigneeId !== undefined)
            data.assignee = { connect: { id: dto.assigneeId } };
        if (dto.dueAt !== undefined)
            data.dueAt = new Date(dto.dueAt);
        if (dto.type !== undefined)
            data.type = dto.type;
        if (dto.status !== undefined)
            data.status = dto.status;
        if (dto.priority !== undefined)
            data.priority = dto.priority;
        if (dto.title !== undefined)
            data.title = dto.title.trim() || null;
        if (dto.description !== undefined) {
            data.description = dto.description.trim() || null;
        }
        if (dto.linkedEntityType !== undefined ||
            dto.linkedEntityId !== undefined) {
            const linkType = dto.linkedEntityType?.trim() ?? existing.linkedEntityType;
            const linkId = dto.linkedEntityId?.trim() ?? existing.linkedEntityId;
            if (linkType !== create_task_dto_1.TASK_LINK_NONE &&
                (!linkId || linkId === create_task_dto_1.TASK_LINK_NONE)) {
                throw new common_1.BadRequestException('Укажите ID объекта связи');
            }
            data.linkedEntityType = linkType;
            data.linkedEntityId =
                linkType === create_task_dto_1.TASK_LINK_NONE ? create_task_dto_1.TASK_LINK_NONE : linkId;
        }
        if (dto.archived !== undefined) {
            data.archived = dto.archived;
        }
        const task = await this.prisma.task.update({
            where: { id },
            data,
            include: { assignee: true },
        });
        const [enriched] = await this.enrichTasks([task]);
        return enriched;
    }
    async remove(id) {
        const existing = await this.prisma.task.findUnique({ where: { id } });
        if (!existing)
            throw new common_1.NotFoundException();
        if (!existing.archived) {
            throw new common_1.BadRequestException('Удалить можно только задачу из архива (сначала перенесите в архив)');
        }
        await this.prisma.task.delete({ where: { id } });
        return { ok: true, id };
    }
    async listComments(taskId) {
        const task = await this.prisma.task.findUnique({ where: { id: taskId } });
        if (!task)
            throw new common_1.NotFoundException();
        return this.prisma.taskComment.findMany({
            where: { taskId },
            orderBy: { createdAt: 'asc' },
            include: {
                author: {
                    select: { id: true, email: true, displayName: true },
                },
            },
        });
    }
    async addComment(taskId, authorId, dto) {
        const task = await this.prisma.task.findUnique({ where: { id: taskId } });
        if (!task)
            throw new common_1.NotFoundException();
        const body = dto.body.trim();
        if (!body)
            throw new common_1.BadRequestException('Пустой комментарий');
        return this.prisma.taskComment.create({
            data: {
                taskId,
                authorId,
                body,
            },
            include: {
                author: {
                    select: { id: true, email: true, displayName: true },
                },
            },
        });
    }
};
exports.TasksService = TasksService;
exports.TasksService = TasksService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], TasksService);
//# sourceMappingURL=tasks.service.js.map