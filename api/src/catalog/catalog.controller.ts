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
import { assertAdminDeleteUser } from '../auth/admin-delete';
import type { AuthUserView } from '../auth/auth-user.types';
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

@Controller('catalog/items')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get()
  list(@Query('skip') skip?: string, @Query('take') take?: string) {
    return this.catalogService.findAll({
      skip: skip != null ? Number(skip) : undefined,
      take: take != null ? Number(take) : undefined,
    });
  }

  @Post()
  create(@Body() body: CreateCatalogItemDto) {
    return this.catalogService.create(body);
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
  patch(@Param('id') id: string, @Body() body: UpdateCatalogItemDto) {
    return this.catalogService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: Request) {
    assertAdminDeleteUser(req.user as AuthUserView);
    return this.catalogService.removeCatalogItem(id);
  }
}
