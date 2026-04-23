import { TaskPriority, TaskStatus, TaskType } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

/** Свободная задача без привязки к сущности. */
export const TASK_LINK_NONE = 'none' as const;

export class CreateTaskDto {
  @IsUUID()
  assigneeId!: string;

  @IsDateString()
  dueAt!: string;

  @IsOptional()
  @IsEnum(TaskType)
  type?: TaskType;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  description?: string;

  /** Например `deal`, `contract`, `none`. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  linkedEntityType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  linkedEntityId?: string;
}
