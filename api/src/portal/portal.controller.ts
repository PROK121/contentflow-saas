import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Query,
  Req,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { Request } from 'express';
import type { AuthUserView } from '../auth/auth-user.types';
import { PortalService } from './portal.service';

@Controller('portal/rights-owner')
export class PortalController {
  constructor(private readonly portalService: PortalService) {}

  @Get('summary')
  summary(@Query('orgId') orgId: string | undefined, @Req() req: Request) {
    const me = req.user as AuthUserView | undefined;
    if (!me) throw new BadRequestException('Auth required');
    if (me.role === UserRole.rights_owner) {
      if (!me.organizationId) {
        throw new ForbiddenException('Пользователь не привязан к организации');
      }
      return this.portalService.rightsOwnerSummary(me.organizationId);
    }
    if (me.role !== UserRole.admin && me.role !== UserRole.manager) {
      throw new ForbiddenException('Недостаточно прав');
    }
    if (!orgId) {
      throw new BadRequestException('Query orgId is required for manager/admin');
    }
    return this.portalService.rightsOwnerSummary(orgId);
  }
}
