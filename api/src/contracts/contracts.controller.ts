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
  StreamableFile,
} from '@nestjs/common';
import type { Request } from 'express';
import { assertAdminDeleteUser } from '../auth/admin-delete';
import type { AuthUserView } from '../auth/auth-user.types';
import { ContractsService } from './contracts.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { PatchContractDto } from './dto/patch-contract.dto';

@Controller('contracts')
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Get()
  list(
    @Query('q') q?: string,
    @Query('limit') limit?: string,
    @Query('archivedOnly') archivedOnly?: string,
    @Query('signedOnly') signedOnly?: string,
  ) {
    const take =
      limit != null && limit !== '' ? Number.parseInt(limit, 10) : undefined;
    const only =
      archivedOnly === 'true' || archivedOnly === '1' || archivedOnly === 'yes';
    const signed =
      signedOnly === 'true' || signedOnly === '1' || signedOnly === 'yes';
    return this.contractsService.findAll({
      q: q?.trim() || undefined,
      take: Number.isFinite(take) ? take : undefined,
      archivedOnly: only,
      signedOnly: signed,
    });
  }

  @Post()
  create(@Body() body: CreateContractDto) {
    return this.contractsService.createDraft(body);
  }

  @Get(':contractId/versions/:versionNum/download')
  async downloadVersion(
    @Param('contractId') contractId: string,
    @Param('versionNum') versionNum: string,
    @Query('inline') inline?: string,
  ) {
    const v = Number.parseInt(versionNum, 10);
    if (!Number.isFinite(v) || v < 1) {
      throw new BadRequestException('Invalid version');
    }
    const { stream, fileName } =
      await this.contractsService.getVersionFileForDownload(contractId, v);
    const asciiName =
      fileName.replace(/[^\x20-\x7E]+/g, '_').replace(/"/g, '') ||
      `contract-v${v}.pdf`;
    const utf8Name = encodeURIComponent(fileName);
    const asInline = inline === '1' || inline === 'true' || inline === 'yes';
    return new StreamableFile(stream, {
      type: 'application/pdf',
      disposition: asInline
        ? `inline; filename="${asciiName}"; filename*=UTF-8''${utf8Name}`
        : `attachment; filename="${asciiName}"; filename*=UTF-8''${utf8Name}`,
    });
  }

  @Get(':contractId/versions')
  async versions(@Param('contractId') contractId: string) {
    const contract = await this.contractsService.findById(contractId);
    if (!contract) throw new NotFoundException();
    return this.contractsService.versions(contractId);
  }

  @Get(':contractId/diff-deal')
  async diffDeal(@Param('contractId') contractId: string) {
    return this.contractsService.compareWithDeal(contractId);
  }

  @Post(':contractId/send')
  async send(
    @Param('contractId') contractId: string,
    @Body() body: { signingDueAt?: string },
  ) {
    return this.contractsService.markSent(contractId, body?.signingDueAt);
  }

  @Post(':contractId/sign')
  async sign(@Param('contractId') contractId: string) {
    return this.contractsService.markSigned(contractId);
  }

  @Post(':contractId/expire-draft')
  async expireDraft(@Param('contractId') contractId: string) {
    return this.contractsService.markExpiredDraft(contractId);
  }

  @Post(':contractId/manual-version')
  async manualVersion(
    @Param('contractId') contractId: string,
    @Body() body: { note?: string },
  ) {
    return this.contractsService.addManualVersion(contractId, body?.note);
  }

  @Get(':contractId')
  async one(@Param('contractId') contractId: string) {
    const contract = await this.contractsService.findById(contractId);
    if (!contract) throw new NotFoundException();
    return contract;
  }

  @Patch(':contractId')
  async patch(
    @Param('contractId') contractId: string,
    @Body() body: PatchContractDto,
  ) {
    if (body.archived === undefined) {
      throw new BadRequestException('Укажите archived');
    }
    return this.contractsService.updateArchived(contractId, body.archived);
  }

  @Delete(':contractId')
  async remove(@Param('contractId') contractId: string, @Req() req: Request) {
    assertAdminDeleteUser(req.user as AuthUserView);
    return this.contractsService.removeContract(contractId);
  }
}
