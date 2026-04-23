import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { OrganizationType } from '@prisma/client';
import { OrganizationsService } from './organizations.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';

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
}
