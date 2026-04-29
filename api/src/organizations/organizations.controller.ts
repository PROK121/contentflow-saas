import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { HolderFinanceVisibility, OrganizationType, UserRole } from '@prisma/client';
import { IsIn } from 'class-validator';
import type { Request } from 'express';
import { assertManagerOrAdmin } from '../auth/rbac';
import { OrganizationsService } from './organizations.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';

class SetHolderVisibilityDto {
  @IsIn(['limited', 'full'])
  visibility!: HolderFinanceVisibility;
}

class SetHolderUserVisibilityDto {
  @IsIn(['inherit', 'limited', 'full'])
  visibility!: 'inherit' | HolderFinanceVisibility;
}

@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get()
  list(@Query('type') type: OrganizationType | undefined, @Req() req: Request) {
    assertManagerOrAdmin(req);
    return this.organizationsService.list(type);
  }

  @Post()
  create(@Body() body: CreateOrganizationDto, @Req() req: Request) {
    assertManagerOrAdmin(req);
    return this.organizationsService.create(body);
  }

  @Patch(':id/holder-visibility')
  setHolderVisibility(
    @Param('id') id: string,
    @Body() body: SetHolderVisibilityDto,
    @Req() req: Request,
  ) {
    assertManagerOrAdmin(req);
    if (body.visibility !== 'limited' && body.visibility !== 'full') {
      throw new BadRequestException('Допустимые значения: limited | full');
    }
    return this.organizationsService.setHolderFinanceVisibility(
      id,
      body.visibility,
    );
  }

  /// Доступ к финансам в кабинете для одного представителя правообладателя
  /// (при нескольких учётках — настраивается отдельно). `inherit` = как у компании.
  @Patch(':id/holder-representatives/:userId/visibility')
  setHolderUserVisibility(
    @Param('id') orgId: string,
    @Param('userId') userId: string,
    @Body() body: SetHolderUserVisibilityDto,
    @Req() req: Request,
  ) {
    assertManagerOrAdmin(req);
    if (
      body.visibility !== 'inherit' &&
      body.visibility !== 'limited' &&
      body.visibility !== 'full'
    ) {
      throw new BadRequestException('Допустимые значения: inherit | limited | full');
    }
    return this.organizationsService.setHolderUserFinanceOverride(
      orgId,
      userId,
      body.visibility,
    );
  }

  /// История действий правообладателей в кабинете /holder/* по конкретной
  /// организации. Менеджер видит, кто заходил, что скачивал/подписывал,
  /// какие материалы загружал.
  @Get(':id/audit')
  audit(
    @Param('id') id: string,
    @Query('limit') limit?: string,
    @Req() req?: Request,
  ) {
    if (!req) throw new BadRequestException('Auth required');
    assertManagerOrAdmin(req);
    const parsed = limit ? Number.parseInt(limit, 10) : undefined;
    return this.organizationsService.listAuditLog(
      id,
      Number.isFinite(parsed) ? (parsed as number) : 50,
    );
  }
}
