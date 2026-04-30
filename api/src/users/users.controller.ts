import { Controller, Get, Req } from '@nestjs/common';
import type { Request } from 'express';
import { assertManagerOrAdmin } from '../auth/rbac';
import { Roles } from '../auth/roles.decorator';
import { UsersService } from './users.service';

@Roles('admin', 'manager')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('managers')
  managers(@Req() req: Request) {
    assertManagerOrAdmin(req);
    return this.usersService.listManagers();
  }
}
