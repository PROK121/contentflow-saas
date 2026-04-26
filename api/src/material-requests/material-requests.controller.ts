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
import { createReadStream, existsSync } from 'fs';
import type { Request } from 'express';
import type { AuthUserView } from '../auth/auth-user.types';
import {
  CreateMaterialRequestDto,
  ReviewUploadDto,
  UpdateMaterialRequestDto,
} from './dto';
import { MATERIAL_SLOTS } from './material-slots';
import { MaterialRequestsService } from './material-requests.service';

function authUser(req: Request): AuthUserView {
  return req.user as AuthUserView;
}

/// CRM-сторона работы с запросами материалов. Доступна всем
/// аутентифицированным пользователям, кроме rights_owner — последние
/// блокируются в `middleware.ts` фронта (но если кто-то постучится
/// напрямую в API, JwtAuthGuard всё равно проверит role-based роуты
/// в будущем — пока этот контроллер открыт для менеджеров, маркетологов
/// и админов одинаково).
@Controller()
export class MaterialRequestsController {
  constructor(private readonly service: MaterialRequestsService) {}

  /// Каталог слотов (для UI). Не зависит от данных, кэшируется фронтом.
  @Get('material-slots')
  slotsCatalog() {
    return MATERIAL_SLOTS;
  }

  @Get('material-requests')
  list(
    @Query('catalogItemId') catalogItemId?: string,
    @Query('status') status?: string,
  ) {
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
  create(@Body() dto: CreateMaterialRequestDto, @Req() req: Request) {
    const user = authUser(req);
    return this.service.createForCatalogItem(dto, user.id);
  }

  @Get('material-requests/:id')
  getOne(@Param('id') id: string) {
    return this.service.findByIdForManager(id);
  }

  @Patch('material-requests/:id')
  patch(@Param('id') id: string, @Body() dto: UpdateMaterialRequestDto) {
    return this.service.update(id, dto);
  }

  @Delete('material-requests/:id')
  cancel(@Param('id') id: string) {
    return this.service.cancel(id);
  }

  @Post('material-requests/:id/uploads/:uploadId/review')
  @HttpCode(HttpStatus.OK)
  review(
    @Param('id') id: string,
    @Param('uploadId') uploadId: string,
    @Body() dto: ReviewUploadDto,
    @Req() req: Request,
  ) {
    return this.service.reviewUpload(id, uploadId, authUser(req), dto);
  }

  @Get('material-requests/:id/uploads/:uploadId/download')
  async download(
    @Param('id') id: string,
    @Param('uploadId') uploadId: string,
    @Query('inline') inline?: string,
  ) {
    const meta = await this.service.getUploadFileMeta(id, uploadId);
    if (!existsSync(meta.absPath)) {
      throw new NotFoundException('Файл недоступен');
    }
    const ascii =
      meta.originalName.replace(/[^\x20-\x7E]+/g, '_').replace(/"/g, '') ||
      'file';
    const utf8 = encodeURIComponent(meta.originalName);
    const asInline = inline === '1' || inline === 'true' || inline === 'yes';
    return new StreamableFile(createReadStream(meta.absPath), {
      type: meta.mimeType,
      disposition: asInline
        ? `inline; filename="${ascii}"; filename*=UTF-8''${utf8}`
        : `attachment; filename="${ascii}"; filename*=UTF-8''${utf8}`,
    });
  }
}
