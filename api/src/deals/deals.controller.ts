import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { existsSync, unlinkSync } from 'fs';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomUUID } from 'crypto';
import type { Request } from 'express';
import { assertAdminDeleteUser } from '../auth/admin-delete';
import type { AuthUserView } from '../auth/auth-user.types';
import * as fs from 'fs';
import { diskStorage } from 'multer';
import * as path from 'path';
import { DealsService } from './deals.service';
import { CreateDealDto } from './dto/create-deal.dto';
import { DealActivityDto } from './dto/deal-activity.dto';
import { UpdateDealDto } from './dto/update-deal.dto';
import {
  SoldHintsDto,
  ValidateRightsDto,
} from './dto/rights-selection-item.dto';
import { serializeForJson } from '../common/serialize-for-json';
import {
  isDealDocumentSlot,
  type DealDocumentSlot,
} from './deal-document-slots';
import { documentMimeFilter } from '../common/multer-mime-filter';

function dealFileUploadOptions() {
  return {
    storage: diskStorage({
      destination: (req: Request, _file, cb) => {
        const dealId = req.params['id'] as string;
        const root =
          process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'uploads');
        const dir = path.join(root, 'deals', dealId);
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
      },
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname) || '';
        cb(null, `${randomUUID()}${ext}`);
      },
    }),
    limits: { fileSize: 35 * 1024 * 1024 },
    fileFilter: documentMimeFilter,
  };
}

function dealDocumentUploadOptions() {
  return {
    storage: diskStorage({
      destination: (req: Request, _file, cb) => {
        const dealId = req.params['id'] as string;
        const root =
          process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'uploads');
        const dir = path.join(root, 'deals', dealId, 'documents');
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
      },
      filename: (req, file, cb) => {
        const slot = req.params['slot'] as string;
        const ext = path.extname(file.originalname) || '';
        cb(null, `${slot}${ext.toLowerCase()}`);
      },
    }),
    limits: { fileSize: 35 * 1024 * 1024 },
    fileFilter: documentMimeFilter,
  };
}

@Controller('deals')
export class DealsController {
  constructor(private readonly dealsService: DealsService) {}

  @Post('sold-hints')
  soldHints(@Body() body: SoldHintsDto) {
    return this.dealsService.soldHints(body.catalogItemIds);
  }

  @Post('rights/validate')
  validateRights(@Body() body: ValidateRightsDto) {
    return this.dealsService.validateRights(body);
  }

  @Get()
  list(
    @Query('stage') stage?: string,
    @Query('q') q?: string,
    @Query('ownerUserId') ownerUserId?: string,
    @Query('buyerOrgId') buyerOrgId?: string,
    @Query('currency') currency?: string,
    @Query('catalogItemId') catalogItemId?: string,
    @Query('kind') kind?: string,
    @Query('archived') archived?: string,
    @Query('limit') limit?: string,
  ) {
    const take =
      limit != null && limit !== '' ? Number.parseInt(limit, 10) : undefined;
    return this.dealsService.findAll({
      stage,
      q,
      ownerUserId,
      buyerOrgId,
      currency,
      catalogItemId,
      kind,
      archived: archived === 'true' || archived === '1',
      take: Number.isFinite(take) ? take : undefined,
    });
  }

  @Post()
  create(@Body() body: CreateDealDto) {
    return this.dealsService.create(body);
  }

  @Post(':id/duplicate')
  duplicate(@Param('id') id: string) {
    return this.dealsService.duplicate(id);
  }

  @Get(':id/payment-preview')
  async paymentPreview(@Param('id') id: string) {
    return this.dealsService.paymentPreview(id);
  }

  @Get(':id/documents/:slot/file')
  async downloadDealDocument(
    @Param('id') dealId: string,
    @Param('slot') slot: string,
  ) {
    if (!isDealDocumentSlot(slot)) {
      throw new BadRequestException('Неизвестный тип документа');
    }
    return this.dealsService.getDealDocumentFile(
      dealId,
      slot as DealDocumentSlot,
    );
  }

  @Post(':id/documents/:slot')
  @UseInterceptors(FileInterceptor('file', dealDocumentUploadOptions()))
  async uploadDealDocument(
    @Param('id') dealId: string,
    @Param('slot') slot: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!isDealDocumentSlot(slot)) {
      if (file?.path && existsSync(file.path)) unlinkSync(file.path);
      throw new BadRequestException('Неизвестный тип документа');
    }
    if (!file) throw new BadRequestException('Файл обязателен');
    const deal = await this.dealsService.uploadDealDocument(
      dealId,
      slot as DealDocumentSlot,
      file,
    );
    return serializeForJson(deal);
  }

  @Delete(':id/documents/:slot')
  async deleteDealDocument(
    @Param('id') dealId: string,
    @Param('slot') slot: string,
  ) {
    if (!isDealDocumentSlot(slot)) {
      throw new BadRequestException('Неизвестный тип документа');
    }
    const deal = await this.dealsService.deleteDealDocument(
      dealId,
      slot as DealDocumentSlot,
    );
    return serializeForJson(deal);
  }

  @Get(':id/activities/:activityId/file')
  async downloadActivityFile(
    @Param('id') dealId: string,
    @Param('activityId') activityId: string,
  ) {
    return this.dealsService.getActivityFile(dealId, activityId);
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    const deal = await this.dealsService.findOne(id);
    if (!deal) throw new NotFoundException();
    return serializeForJson(deal);
  }

  @Patch(':id')
  async patch(@Param('id') id: string, @Body() body: UpdateDealDto) {
    return this.dealsService.update(id, body);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: Request) {
    assertAdminDeleteUser(req.user as AuthUserView);
    return this.dealsService.removeDeal(id);
  }

  @Post(':id/activities/file')
  @UseInterceptors(FileInterceptor('file', dealFileUploadOptions()))
  async uploadActivityFile(
    @Param('id') dealId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('message') message?: string,
    @Body('userId') userId?: string,
  ) {
    if (!file) throw new BadRequestException('Файл обязателен');
    return this.dealsService.addActivityFile(dealId, file, {
      message,
      userId,
    });
  }

  @Post(':id/activities')
  async activity(@Param('id') id: string, @Body() body: DealActivityDto) {
    return this.dealsService.addActivity(id, body);
  }

  @Post(':id/drive-folder')
  async generateDriveFolder(
    @Param('id') id: string,
    @Body('email') email: string,
    @Body('catalogItemId') catalogItemId: string,
  ) {
    if (!email?.trim()) {
      throw new BadRequestException('email обязателен');
    }
    if (!catalogItemId?.trim()) {
      throw new BadRequestException('catalogItemId обязателен');
    }
    return this.dealsService.generateDriveFolder(id, email.trim(), catalogItemId.trim());
  }
}
