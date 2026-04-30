import {
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
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import type { Request } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CrmAuditService } from '../audit/crm-audit.service';
import { assertAdminDeleteUser } from '../auth/admin-delete';
import type { AuthUserView } from '../auth/auth-user.types';
import { Roles } from '../auth/roles.decorator';
import { documentMimeFilter } from '../common/multer-mime-filter';
import { CreateManualCommercialOfferDto } from './dto/create-manual-commercial-offer.dto';
import { CreateCommercialOfferDto } from './dto/create-commercial-offer.dto';
import { PatchCommercialOfferDto } from './dto/patch-commercial-offer.dto';
import { CommercialOffersService } from './commercial-offers.service';

function manualOfferUploadOptions() {
  return {
    storage: memoryStorage(),
    limits: { fileSize: 35 * 1024 * 1024 },
    fileFilter: documentMimeFilter,
  };
}

@Roles('admin', 'manager')
@Controller('commercial-offers')
export class CommercialOffersController {
  constructor(
    private readonly commercialOffersService: CommercialOffersService,
    private readonly audit: CrmAuditService,
  ) {}

  @Get()
  list(
    @Query('archivedOnly') archivedOnly?: string,
    @Query('signedOnly') signedOnly?: string,
  ) {
    const arch =
      archivedOnly === 'true' || archivedOnly === '1' || archivedOnly === 'yes';
    const signed =
      signedOnly === 'true' || signedOnly === '1' || signedOnly === 'yes';
    return this.commercialOffersService.findAll({
      archivedOnly: arch,
      signedOnly: signed,
    });
  }

  @Post()
  async create(@Body() body: CreateCommercialOfferDto, @Req() req: Request) {
    const result = await this.commercialOffersService.create(body);
    void this.audit.log({
      user: req.user as AuthUserView | undefined,
      action: 'offer.create',
      entityType: 'CommercialOffer',
      entityId: (result as { id?: string })?.id,
      ...CrmAuditService.fromRequest(req),
    });
    return result;
  }

  @Post('manual')
  @UseInterceptors(FileInterceptor('file', manualOfferUploadOptions()))
  async createManual(
    @Body() body: CreateManualCommercialOfferDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() req: Request,
  ) {
    const result = await this.commercialOffersService.createManual(body, file);
    void this.audit.log({
      user: req.user as AuthUserView | undefined,
      action: 'offer.create_manual',
      entityType: 'CommercialOffer',
      entityId: (result as { id?: string })?.id,
      ...CrmAuditService.fromRequest(req),
    });
    return result;
  }

  @Patch(':id')
  async patch(
    @Param('id') id: string,
    @Body() body: PatchCommercialOfferDto,
    @Req() req: Request,
  ) {
    const result = await this.commercialOffersService.setArchived(
      id,
      body.archived,
    );
    void this.audit.log({
      user: req.user as AuthUserView | undefined,
      action: 'offer.archive',
      entityType: 'CommercialOffer',
      entityId: id,
      metadata: { archived: body.archived },
      ...CrmAuditService.fromRequest(req),
    });
    return result;
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: Request) {
    assertAdminDeleteUser(req.user as AuthUserView);
    const result = await this.commercialOffersService.remove(id);
    void this.audit.log({
      user: req.user as AuthUserView | undefined,
      action: 'offer.delete',
      entityType: 'CommercialOffer',
      entityId: id,
      ...CrmAuditService.fromRequest(req),
    });
    return result;
  }

  @Get(':id/document')
  async document(@Param('id') id: string) {
    const doc = await this.commercialOffersService.getDocumentStream(id);
    if (!doc) throw new NotFoundException();
    const asciiName =
      doc.fileName.replace(/[^\x20-\x7E]+/g, '_').replace(/"/g, '') ||
      'offer.docx';
    const utf8Name = encodeURIComponent(doc.fileName);
    return new StreamableFile(doc.stream, {
      type: 'application/pdf',
      disposition: `attachment; filename="${asciiName}"; filename*=UTF-8''${utf8Name}`,
    });
  }

  @Get(':id')
  one(@Param('id') id: string) {
    return this.commercialOffersService.findById(id);
  }
}
