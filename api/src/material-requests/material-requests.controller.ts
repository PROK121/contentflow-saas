import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  StreamableFile,
} from '@nestjs/common';
import { MaterialRequestStatus } from '@prisma/client';
import type { Request } from 'express';
import { CrmAuditService } from '../audit/crm-audit.service';
import type { AuthUserView } from '../auth/auth-user.types';
import { assertManagerOrAdmin } from '../auth/rbac';
import { Roles } from '../auth/roles.decorator';
import {
  CreateMaterialRequestDto,
  ReviewUploadDto,
  UpdateMaterialRequestDto,
} from './dto';
import { MATERIAL_SLOTS } from './material-slots';
import { MaterialRequestsService } from './material-requests.service';

/// CRM-сторона работы с запросами материалов. Доступна всем
/// аутентифицированным пользователям, кроме rights_owner — последние
/// блокируются в `middleware.ts` фронта (но если кто-то постучится
/// напрямую в API, JwtAuthGuard всё равно проверит role-based роуты
/// в будущем — пока этот контроллер открыт для менеджеров, маркетологов
/// и админов одинаково).
@Roles('admin', 'manager')
@Controller()
export class MaterialRequestsController {
  constructor(
    private readonly service: MaterialRequestsService,
    private readonly audit: CrmAuditService,
  ) {}

  /// Каталог слотов (для UI). Не зависит от данных, кэшируется фронтом.
  @Get('material-slots')
  slotsCatalog() {
    return MATERIAL_SLOTS;
  }

  @Get('material-requests')
  list(
    @Query('catalogItemId') catalogItemId?: string,
    @Query('status') status?: string,
    @Req() req?: Request,
  ) {
    if (!req) throw new BadRequestException('Auth required');
    assertManagerOrAdmin(req);
    if (catalogItemId) {
      return this.service.listForCatalogItem(catalogItemId);
    }
    const enumStatus = status as MaterialRequestStatus | undefined;
    if (
      enumStatus &&
      !Object.values(MaterialRequestStatus).includes(enumStatus)
    ) {
      throw new BadRequestException('Неизвестный status');
    }
    return this.service.listAllForManager({ status: enumStatus });
  }

  @Post('material-requests')
  async create(@Body() dto: CreateMaterialRequestDto, @Req() req: Request) {
    const user = assertManagerOrAdmin(req);
    const result = await this.service.createForCatalogItem(dto, user.id);
    void this.audit.log({
      user,
      action: 'material_request.create',
      entityType: 'MaterialRequest',
      entityId: result.id,
      organizationId: result.organizationId ?? undefined,
      metadata: { catalogItemId: dto.catalogItemId, slots: dto.requestedSlots },
      ...CrmAuditService.fromRequest(req),
    });
    return result;
  }

  @Get('material-requests/:id')
  getOne(@Param('id') id: string, @Req() req: Request) {
    assertManagerOrAdmin(req);
    return this.service.findByIdForManager(id);
  }

  @Patch('material-requests/:id')
  patch(@Param('id') id: string, @Body() dto: UpdateMaterialRequestDto, @Req() req: Request) {
    assertManagerOrAdmin(req);
    return this.service.update(id, dto);
  }

  @Delete('material-requests/:id')
  async cancel(@Param('id') id: string, @Req() req: Request) {
    const user = assertManagerOrAdmin(req);
    const result = await this.service.cancel(id);
    void this.audit.log({
      user,
      action: 'material_request.cancel',
      entityType: 'MaterialRequest',
      entityId: id,
      ...CrmAuditService.fromRequest(req),
    });
    return result;
  }

  @Post('material-requests/:id/uploads/:uploadId/review')
  @HttpCode(HttpStatus.OK)
  async review(
    @Param('id') id: string,
    @Param('uploadId') uploadId: string,
    @Body() dto: ReviewUploadDto,
    @Req() req: Request,
  ) {
    const user = assertManagerOrAdmin(req);
    const result = await this.service.reviewUpload(id, uploadId, user, dto);
    void this.audit.log({
      user,
      action: 'material_request.review',
      entityType: 'MaterialUpload',
      entityId: uploadId,
      metadata: { requestId: id, decision: dto.reviewStatus, comment: dto.reviewerComment },
      ...CrmAuditService.fromRequest(req),
    });
    return result;
  }

  @Get('material-requests/:id/uploads/:uploadId/download')
  async download(
    @Param('id') id: string,
    @Param('uploadId') uploadId: string,
    @Query('inline') inline?: string,
    @Req() req?: Request,
  ) {
    if (!req) throw new BadRequestException('Auth required');
    assertManagerOrAdmin(req);
    const meta = await this.service.getUploadFileForDownload(id, uploadId);
    const ascii =
      meta.originalName.replace(/[^\x20-\x7E]+/g, '_').replace(/"/g, '') ||
      'file';
    const utf8 = encodeURIComponent(meta.originalName);
    const asInline = inline === '1' || inline === 'true' || inline === 'yes';
    return new StreamableFile(meta.stream, {
      type: meta.mimeType,
      disposition: asInline
        ? `inline; filename="${ascii}"; filename*=UTF-8''${utf8}`
        : `attachment; filename="${ascii}"; filename*=UTF-8''${utf8}`,
    });
  }
}
