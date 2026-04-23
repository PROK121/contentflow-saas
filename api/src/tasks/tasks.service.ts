import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TaskPriority, TaskStatus, TaskType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto, TASK_LINK_NONE } from './dto/create-task.dto';
import { CreateTaskCommentDto } from './dto/create-task-comment.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

export type TaskListFilters = {
  assigneeId?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  type?: TaskType;
  overdue?: boolean;
  /** Только архивные задачи (без разбиения по колонкам). */
  archivedOnly?: boolean;
  /** Поиск по названию и описанию (без учёта регистра). */
  q?: string;
  skip?: number;
  /** Лимит записей (1–200). Без limit — возвращаются все подходящие (как раньше). */
  take?: number;
};

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filters?: TaskListFilters) {
    const where: Prisma.TaskWhereInput = {};
    const archivedOnly = filters?.archivedOnly === true;
    if (archivedOnly) {
      where.archived = true;
    } else {
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
      where.status = { not: TaskStatus.done };
    }
    if (filters?.q?.trim()) {
      const q = filters.q.trim();
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ];
    }

    const skip =
      filters?.skip != null ? Math.max(0, Math.floor(filters.skip)) : undefined;
    const takeRaw = filters?.take;
    const take =
      takeRaw != null
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

  /** Пути для UI + подпись привязки (название сделки или номер контракта). Два батч-запроса к БД. */
  private async enrichTasks<
    T extends {
      id: string;
      linkedEntityType: string;
      linkedEntityId: string;
    },
  >(
    tasks: T[],
  ): Promise<
    (T & { primaryPath: string | null; linkedLabel: string | null })[]
  > {
    const dealIds = [
      ...new Set(
        tasks
          .filter((t) => t.linkedEntityType === 'deal')
          .map((t) => t.linkedEntityId),
      ),
    ];
    const contractIds = [
      ...new Set(
        tasks
          .filter((t) => t.linkedEntityType === 'contract')
          .map((t) => t.linkedEntityId),
      ),
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
    const contractById = new Map(
      contracts.map((c) => [c.id, { dealId: c.dealId, number: c.number }]),
    );

    return tasks.map((t) => {
      let primaryPath: string | null = null;
      let linkedLabel: string | null = null;
      if (t.linkedEntityType === 'deal') {
        primaryPath = `/deals/${t.linkedEntityId}`;
        linkedLabel = dealTitleById.get(t.linkedEntityId) ?? null;
      } else if (t.linkedEntityType === 'contract') {
        const c = contractById.get(t.linkedEntityId);
        if (c) {
          primaryPath = `/deals/${c.dealId}`;
          linkedLabel = c.number;
        }
      }
      return { ...t, primaryPath, linkedLabel };
    });
  }

  async create(dto: CreateTaskDto) {
    const linkType = dto.linkedEntityType?.trim() || TASK_LINK_NONE;
    const linkId = dto.linkedEntityId?.trim() || TASK_LINK_NONE;
    if (linkType !== TASK_LINK_NONE && (!linkId || linkId === TASK_LINK_NONE)) {
      throw new BadRequestException(
        'Укажите объект связи или выберите «Без привязки»',
      );
    }
    if (
      linkType === TASK_LINK_NONE &&
      linkId !== TASK_LINK_NONE &&
      linkId.length > 0
    ) {
      throw new BadRequestException('Несогласованная привязка задачи');
    }

    const task = await this.prisma.task.create({
      data: {
        assigneeId: dto.assigneeId,
        dueAt: new Date(dto.dueAt),
        type: dto.type ?? TaskType.custom,
        status: dto.status ?? TaskStatus.todo,
        priority: dto.priority ?? TaskPriority.medium,
        title: dto.title?.trim() || null,
        description: dto.description?.trim() || null,
        linkedEntityType: linkType,
        linkedEntityId: linkType === TASK_LINK_NONE ? TASK_LINK_NONE : linkId,
      },
      include: { assignee: true },
    });
    const [enriched] = await this.enrichTasks([task]);
    return enriched;
  }

  async update(id: string, dto: UpdateTaskDto) {
    const existing = await this.prisma.task.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException();

    const data: Prisma.TaskUpdateInput = {};
    if (dto.assigneeId !== undefined)
      data.assignee = { connect: { id: dto.assigneeId } };
    if (dto.dueAt !== undefined) data.dueAt = new Date(dto.dueAt);
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.priority !== undefined) data.priority = dto.priority;
    if (dto.title !== undefined) data.title = dto.title.trim() || null;
    if (dto.description !== undefined) {
      data.description = dto.description.trim() || null;
    }
    if (
      dto.linkedEntityType !== undefined ||
      dto.linkedEntityId !== undefined
    ) {
      const linkType =
        dto.linkedEntityType?.trim() ?? existing.linkedEntityType;
      const linkId = dto.linkedEntityId?.trim() ?? existing.linkedEntityId;
      if (
        linkType !== TASK_LINK_NONE &&
        (!linkId || linkId === TASK_LINK_NONE)
      ) {
        throw new BadRequestException('Укажите ID объекта связи');
      }
      data.linkedEntityType = linkType;
      data.linkedEntityId =
        linkType === TASK_LINK_NONE ? TASK_LINK_NONE : linkId;
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

  async remove(id: string) {
    const existing = await this.prisma.task.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException();
    if (!existing.archived) {
      throw new BadRequestException(
        'Удалить можно только задачу из архива (сначала перенесите в архив)',
      );
    }
    await this.prisma.task.delete({ where: { id } });
    return { ok: true, id };
  }

  async listComments(taskId: string) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException();
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

  async addComment(
    taskId: string,
    authorId: string,
    dto: CreateTaskCommentDto,
  ) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException();
    const body = dto.body.trim();
    if (!body) throw new BadRequestException('Пустой комментарий');
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
}
