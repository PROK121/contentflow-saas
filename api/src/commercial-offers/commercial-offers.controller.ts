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
} from '@nestjs/common';
import type { Request } from 'express';
import { assertAdminDeleteUser } from '../auth/admin-delete';
import type { AuthUserView } from '../auth/auth-user.types';
import { CreateCommercialOfferDto } from './dto/create-commercial-offer.dto';
import { PatchCommercialOfferDto } from './dto/patch-commercial-offer.dto';
import { CommercialOffersService } from './commercial-offers.service';

@Controller('commercial-offers')
export class CommercialOffersController {
  constructor(
    private readonly commercialOffersService: CommercialOffersService,
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
  create(@Body() body: CreateCommercialOfferDto) {
    return this.commercialOffersService.create(body);
  }

  @Patch(':id')
  patch(@Param('id') id: string, @Body() body: PatchCommercialOfferDto) {
    return this.commercialOffersService.setArchived(id, body.archived);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: Request) {
    assertAdminDeleteUser(req.user as AuthUserView);
    return this.commercialOffersService.remove(id);
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
