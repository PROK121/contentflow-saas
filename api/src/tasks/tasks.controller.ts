import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { TaskPriority, TaskStatus, TaskType } from '@prisma/client';
import { assertAdminDeleteUser } from '../auth/admin-delete';
import type { AuthUserView } from '../auth/auth-user.types';
import { CreateTaskDto } from './dto/create-task.dto';
import { CreateTaskCommentDto } from './dto/create-task-comment.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TasksService } from './tasks.service';

@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  list(
    @Query('assigneeId') assigneeId?: string,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('type') type?: string,
    @Query('overdue') overdue?: string,
    @Query('archivedOnly') archivedOnly?: string,
    @Query('q') q?: string,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
  ) {
    const filters: Parameters<TasksService['findAll']>[0] = {};
    if (
      archivedOnly === 'true' ||
      archivedOnly === '1' ||
      archivedOnly === 'yes'
    ) {
      filters.archivedOnly = true;
    }
    if (assigneeId?.trim()) filters.assigneeId = assigneeId.trim();
    if (q?.trim()) filters.q = q.trim();
    const lim =
      limit != null && limit !== '' ? Number.parseInt(limit, 10) : NaN;
    const sk = skip != null && skip !== '' ? Number.parseInt(skip, 10) : NaN;
    if (Number.isFinite(lim)) {
      filters.take = lim;
      filters.skip = Number.isFinite(sk) ? Math.max(0, sk) : 0;
    }
    if (status && Object.values(TaskStatus).includes(status as TaskStatus)) {
      filters.status = status as TaskStatus;
    }
    if (
      priority &&
      Object.values(TaskPriority).includes(priority as TaskPriority)
    ) {
      filters.priority = priority as TaskPriority;
    }
    if (type && Object.values(TaskType).includes(type as TaskType)) {
      filters.type = type as TaskType;
    }
    if (overdue === 'true' || overdue === '1') {
      filters.overdue = true;
    }
    return this.tasksService.findAll(filters);
  }

  @Post()
  create(@Body() body: CreateTaskDto) {
    return this.tasksService.create(body);
  }

  @Get(':id/comments')
  listComments(@Param('id') id: string) {
    return this.tasksService.listComments(id);
  }

  @Post(':id/comments')
  addComment(
    @Param('id') id: string,
    @Req() req: Request,
    @Body() body: CreateTaskCommentDto,
  ) {
    const user = req.user as AuthUserView;
    return this.tasksService.addComment(id, user.id, body);
  }

  @Patch(':id')
  patch(@Param('id') id: string, @Body() body: UpdateTaskDto) {
    return this.tasksService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: Request) {
    assertAdminDeleteUser(req.user as AuthUserView);
    return this.tasksService.remove(id);
  }
}
