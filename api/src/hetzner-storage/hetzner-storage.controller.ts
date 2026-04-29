import {
  Controller,
  ForbiddenException,
  Get,
  Logger,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { AuthUserView } from '../auth/auth-user.types';
import { HetznerStorageService } from './hetzner-storage.service';
import * as path from 'path';

/**
 * Административные эндпоинты для работы с Hetzner Storage Box.
 * Доступны только пользователям с ролью admin.
 */
@Controller('admin/storage')
export class HetznerStorageController {
  private readonly logger = new Logger(HetznerStorageController.name);

  constructor(private readonly storage: HetznerStorageService) {}

  private assertAdmin(req: Request): void {
    const user = req.user as AuthUserView | undefined;
    if (user?.role !== 'admin') throw new ForbiddenException('Только для администраторов');
  }

  /** Проверка соединения — список файлов в корне Storage Box */
  @Get('ping')
  async ping(@Req() req: Request) {
    this.assertAdmin(req);
    const files = await this.storage.list('/');
    return { ok: true, rootEntries: files };
  }

  /** Список файлов в директории на Storage Box */
  @Get('list/:dir(*)')
  async list(@Req() req: Request, @Param('dir') dir: string) {
    this.assertAdmin(req);
    const files = await this.storage.list(`/${dir}`);
    return { dir: `/${dir}`, files };
  }

  /**
   * Запустить синхронизацию uploads/ → Hetzner вручную.
   * POST /v1/admin/storage/sync
   */
  @Post('sync')
  async sync(@Req() req: Request) {
    this.assertAdmin(req);
    const uploadDir =
      process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'uploads');
    this.logger.log(`Starting sync: ${uploadDir} → /contentflow/uploads`);
    await this.storage.syncLocalToRemote(uploadDir, '/contentflow/uploads');
    return { ok: true, message: `Synced ${uploadDir} → /contentflow/uploads` };
  }

  /**
   * Скачать файл с Storage Box.
   * GET /v1/admin/storage/file/contentflow/uploads/catalog/abc123/poster.jpg
   */
  @Get('file/:filePath(*)')
  async download(
    @Req() req: Request,
    @Param('filePath') filePath: string,
    @Res() res: Response,
  ) {
    this.assertAdmin(req);
    const remotePath = `/${filePath}`;
    const exists = await this.storage.exists(remotePath);
    if (!exists) throw new NotFoundException(`Файл не найден: ${remotePath}`);

    const stream = await this.storage.downloadStream(remotePath);
    const filename = filePath.split('/').pop() ?? 'file';
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    stream.pipe(res);
  }
}
