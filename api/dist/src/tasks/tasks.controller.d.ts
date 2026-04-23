import type { Request } from 'express';
import { CreateTaskDto } from './dto/create-task.dto';
import { CreateTaskCommentDto } from './dto/create-task-comment.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TasksService } from './tasks.service';
export declare class TasksController {
    private readonly tasksService;
    constructor(tasksService: TasksService);
    list(assigneeId?: string, status?: string, priority?: string, type?: string, overdue?: string, archivedOnly?: string, q?: string, limit?: string, skip?: string): Promise<{
        items: ({
            assignee: {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                email: string;
                organizationId: string | null;
                passwordHash: string | null;
                displayName: string | null;
                role: import(".prisma/client").$Enums.UserRole;
                locale: string;
            };
        } & {
            id: string;
            type: import(".prisma/client").$Enums.TaskType;
            createdAt: Date;
            updatedAt: Date;
            title: string | null;
            archived: boolean;
            assigneeId: string;
            dueAt: Date;
            status: import(".prisma/client").$Enums.TaskStatus;
            priority: import(".prisma/client").$Enums.TaskPriority;
            linkedEntityType: string;
            linkedEntityId: string;
            description: string | null;
        } & {
            primaryPath: string | null;
            linkedLabel: string | null;
        })[];
        total: number;
    }>;
    create(body: CreateTaskDto): Promise<{
        assignee: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            email: string;
            organizationId: string | null;
            passwordHash: string | null;
            displayName: string | null;
            role: import(".prisma/client").$Enums.UserRole;
            locale: string;
        };
    } & {
        id: string;
        type: import(".prisma/client").$Enums.TaskType;
        createdAt: Date;
        updatedAt: Date;
        title: string | null;
        archived: boolean;
        assigneeId: string;
        dueAt: Date;
        status: import(".prisma/client").$Enums.TaskStatus;
        priority: import(".prisma/client").$Enums.TaskPriority;
        linkedEntityType: string;
        linkedEntityId: string;
        description: string | null;
    } & {
        primaryPath: string | null;
        linkedLabel: string | null;
    }>;
    listComments(id: string): Promise<({
        author: {
            id: string;
            email: string;
            displayName: string | null;
        };
    } & {
        id: string;
        createdAt: Date;
        body: string;
        taskId: string;
        authorId: string;
    })[]>;
    addComment(id: string, req: Request, body: CreateTaskCommentDto): Promise<{
        author: {
            id: string;
            email: string;
            displayName: string | null;
        };
    } & {
        id: string;
        createdAt: Date;
        body: string;
        taskId: string;
        authorId: string;
    }>;
    patch(id: string, body: UpdateTaskDto): Promise<{
        assignee: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            email: string;
            organizationId: string | null;
            passwordHash: string | null;
            displayName: string | null;
            role: import(".prisma/client").$Enums.UserRole;
            locale: string;
        };
    } & {
        id: string;
        type: import(".prisma/client").$Enums.TaskType;
        createdAt: Date;
        updatedAt: Date;
        title: string | null;
        archived: boolean;
        assigneeId: string;
        dueAt: Date;
        status: import(".prisma/client").$Enums.TaskStatus;
        priority: import(".prisma/client").$Enums.TaskPriority;
        linkedEntityType: string;
        linkedEntityId: string;
        description: string | null;
    } & {
        primaryPath: string | null;
        linkedLabel: string | null;
    }>;
    remove(id: string, req: Request): Promise<{
        ok: boolean;
        id: string;
    }>;
}
