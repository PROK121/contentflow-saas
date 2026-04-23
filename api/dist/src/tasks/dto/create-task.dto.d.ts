import { TaskPriority, TaskStatus, TaskType } from '@prisma/client';
export declare const TASK_LINK_NONE: "none";
export declare class CreateTaskDto {
    assigneeId: string;
    dueAt: string;
    type?: TaskType;
    status?: TaskStatus;
    priority?: TaskPriority;
    title?: string;
    description?: string;
    linkedEntityType?: string;
    linkedEntityId?: string;
}
