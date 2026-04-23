import { TaskPriority, TaskStatus, TaskType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { CreateTaskCommentDto } from './dto/create-task-comment.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
export type TaskListFilters = {
    assigneeId?: string;
    status?: TaskStatus;
    priority?: TaskPriority;
    type?: TaskType;
    overdue?: boolean;
    archivedOnly?: boolean;
    q?: string;
    skip?: number;
    take?: number;
};
export declare class TasksService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findAll(filters?: TaskListFilters): Promise<{
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
    private enrichTasks;
    create(dto: CreateTaskDto): Promise<{
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
    update(id: string, dto: UpdateTaskDto): Promise<{
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
    remove(id: string): Promise<{
        ok: boolean;
        id: string;
    }>;
    listComments(taskId: string): Promise<({
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
    addComment(taskId: string, authorId: string, dto: CreateTaskCommentDto): Promise<{
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
}
