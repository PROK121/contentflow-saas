import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import type { Request } from 'express';
import { CrmAuditService } from '../audit/crm-audit.service';
import { assertAdminDeleteUser } from '../auth/admin-delete';
import type { AuthUserView } from '../auth/auth-user.types';
import { Roles } from '../auth/roles.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import { diskStorage } from 'multer';
import * as path from 'path';
import { CatalogService } from './catalog.service';
import { CreateCatalogItemDto } from './dto/create-catalog-item.dto';
import { UpdateCatalogItemDto } from './dto/update-catalog-item.dto';
import { imageMimeFilter } from '../common/multer-mime-filter';

function catalogPosterUploadOptions() {
  return {
    storage: diskStorage({
      destination: (req: Request, _file, cb) => {
        const itemId = req.params['id'] as string;
        const root =
          process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'uploads');
        const dir = path.join(root, 'catalog', itemId);
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
      },
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname) || '';
        const safe =
          ext && /^\.(jpe?g|png|gif|webp)$/i.test(ext)
            ? ext.toLowerCase()
            : '.jpg';
        cb(null, `${randomUUID()}${safe}`);
      },
    }),
    limits: { fileSize: 12 * 1024 * 1024 },
    fileFilter: imageMimeFilter,
  };
}

@Roles('admin', 'manager')
@Controller('catalog/items')
export class CatalogController {
  constructor(
    private readonly catalogService: CatalogService,
    private readonly audit: CrmAuditService,
  ) {}

  @Get()
  list(@Query('skip') skip?: string, @Query('take') take?: string) {
    return this.catalogService.findAll({
      skip: skip != null ? Number(skip) : undefined,
      take: take != null ? Number(take) : undefined,
    });
  }

  @Post()
  async create(@Body() body: CreateCatalogItemDto, @Req() req: Request) {
    const result = await this.catalogService.create(body);
    void this.audit.log({
      user: req.user as AuthUserView | undefined,
      action: 'catalog.create',
      entityType: 'CatalogItem',
      entityId: (result as { id?: string })?.id,
      organizationId: body.rightsHolderOrgId,
      ...CrmAuditService.fromRequest(req),
    });
    return result;
  }

  @Get(':id/poster')
  getPoster(@Param('id') id: string) {
    return this.catalogService.getPosterFile(id);
  }

  @Post(':id/poster')
  @UseInterceptors(FileInterceptor('file', catalogPosterUploadOptions()))
  uploadPoster(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Передайте файл поля file');
    }
    return this.catalogService.attachPoster(id, file);
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.catalogService.findOne(id);
  }

  @Patch(':id')
  async patch(
    @Param('id') id: string,
    @Body() body: UpdateCatalogItemDto,
    @Req() req: Request,
  ) {
    const result = await this.catalogService.update(id, body);
    void this.audit.log({
      user: req.user as AuthUserView | undefined,
      action: 'catalog.patch',
      entityType: 'CatalogItem',
      entityId: id,
      metadata: { fields: Object.keys(body) },
      ...CrmAuditService.fromRequest(req),
    });
    return result;
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: Request) {
    assertAdminDeleteUser(req.user as AuthUserView);
    const result = await this.catalogService.removeCatalogItem(id);
    void this.audit.log({
      user: req.user as AuthUserView | undefined,
      action: 'catalog.delete',
      entityType: 'CatalogItem',
      entityId: id,
      ...CrmAuditService.fromRequest(req),
    });
    return result;
  }
}
