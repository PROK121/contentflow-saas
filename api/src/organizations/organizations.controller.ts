import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { HolderFinanceVisibility, OrganizationType } from '@prisma/client';
import { IsIn } from 'class-validator';
import { OrganizationsService } from './organizations.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';

class SetHolderVisibilityDto {
  @IsIn(['limited', 'full'])
  visibility!: HolderFinanceVisibility;
}

@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get()
  list(@Query('type') type?: OrganizationType) {
    return this.organizationsService.list(type);
  }

  @Post()
  create(@Body() body: CreateOrganizationDto) {
    return this.organizationsService.create(body);
  }

  @Patch(':id/holder-visibility')
  setHolderVisibility(
    @Param('id') id: string,
    @Body() body: SetHolderVisibilityDto,
  ) {
    if (body.visibility !== 'limited' && body.visibility !== 'full') {
      throw new BadRequestException('Допустимые значения: limited | full');
    }
    return this.organizationsService.setHolderFinanceVisibility(
      id,
      body.visibility,
    );
  }

  /// История действий правообладателей в кабинете /holder/* по конкретной
  /// организации. Менеджер видит, кто заходил, что скачивал/подписывал,
  /// какие материалы загружал.
  @Get(':id/audit')
  audit(
    @Param('id') id: string,
    @Query('limit') limit?: string,
  ) {
    const parsed = limit ? Number.parseInt(limit, 10) : undefined;
    return this.organizationsService.listAuditLog(
      id,
      Number.isFinite(parsed) ? (parsed as number) : 50,
    );
  }
}
