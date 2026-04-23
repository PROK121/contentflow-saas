import { TaskPriority, TaskStatus, TaskType } from '@prisma/client';
export declare class UpdateTaskDto {
    assigneeId?: string;
    dueAt?: string;
    type?: TaskType;
    status?: TaskStatus;
    priority?: TaskPriority;
    title?: string;
    description?: string;
    linkedEntityType?: string;
    linkedEntityId?: string;
    archived?: boolean;
}
