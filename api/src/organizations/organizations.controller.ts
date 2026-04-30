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
import { IsIn, IsOptional, IsString } from 'class-validator';
import type { Request } from 'express';
import { CrmAuditService } from '../audit/crm-audit.service';
import { assertManagerOrAdmin } from '../auth/rbac';
import { Roles } from '../auth/roles.decorator';
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

class SetContactCardDto {
  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  contactName?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @IsString()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  contactTelegram?: string;
}

@Roles('admin', 'manager')
@Controller('organizations')
export class OrganizationsController {
  constructor(
    private readonly organizationsService: OrganizationsService,
    private readonly audit: CrmAuditService,
  ) {}

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
  async setHolderVisibility(
    @Param('id') id: string,
    @Body() body: SetHolderVisibilityDto,
    @Req() req: Request,
  ) {
    const me = assertManagerOrAdmin(req);
    if (body.visibility !== 'limited' && body.visibility !== 'full') {
      throw new BadRequestException('Допустимые значения: limited | full');
    }
    const result = await this.organizationsService.setHolderFinanceVisibility(
      id,
      body.visibility,
    );
    void this.audit.log({
      user: me,
      action: 'org.holder_visibility_set',
      entityType: 'Organization',
      entityId: id,
      organizationId: id,
      metadata: { visibility: body.visibility },
      ...CrmAuditService.fromRequest(req),
    });
    return result;
  }

  /// Доступ к финансам в кабинете для одного представителя правообладателя
  /// (при нескольких учётках — настраивается отдельно). `inherit` = как у компании.
  @Patch(':id/holder-representatives/:userId/visibility')
  async setHolderUserVisibility(
    @Param('id') orgId: string,
    @Param('userId') userId: string,
    @Body() body: SetHolderUserVisibilityDto,
    @Req() req: Request,
  ) {
    const me = assertManagerOrAdmin(req);
    if (
      body.visibility !== 'inherit' &&
      body.visibility !== 'limited' &&
      body.visibility !== 'full'
    ) {
      throw new BadRequestException('Допустимые значения: inherit | limited | full');
    }
    const result = await this.organizationsService.setHolderUserFinanceOverride(
      orgId,
      userId,
      body.visibility,
    );
    void this.audit.log({
      user: me,
      action: 'org.holder_user_visibility_set',
      entityType: 'User',
      entityId: userId,
      organizationId: orgId,
      metadata: { visibility: body.visibility },
      ...CrmAuditService.fromRequest(req),
    });
    return result;
  }

  /// История действий правообладателей в кабинете /holder/* по конкретной
  /// организации. Менеджер видит, кто заходил, что скачивал/подписывал,
  /// какие материалы загружал.
  /// (Метод переименован в `auditList`, чтобы не конфликтовать с
  /// инжектируемым полем `audit: CrmAuditService`.)
  @Get(':id/audit')
  auditList(
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

  @Patch(':id/contact-card')
  async setContactCard(
    @Param('id') id: string,
    @Body() body: SetContactCardDto,
    @Req() req: Request,
  ) {
    const me = assertManagerOrAdmin(req);
    const result = await this.organizationsService.setContactCard(id, body);
    void this.audit.log({
      user: me,
      action: 'org.contact_card_set',
      entityType: 'Organization',
      entityId: id,
      organizationId: id,
      metadata: { fields: Object.keys(body) },
      ...CrmAuditService.fromRequest(req),
    });
    return result;
  }
}
