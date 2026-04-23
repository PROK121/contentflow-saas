import { Injectable } from '@nestjs/common';
import { OrganizationType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  list(type?: OrganizationType) {
    const where: Prisma.OrganizationWhereInput = {};
    if (type) where.type = type;
    return this.prisma.organization.findMany({
      where,
      orderBy: { legalName: 'asc' },
    });
  }

  create(dto: CreateOrganizationDto) {
    return this.prisma.organization.create({
      data: {
        legalName: dto.legalName,
        country: dto.country.toUpperCase(),
        type: dto.type,
        taxId: dto.taxId,
        isResident: dto.isResident ?? false,
      },
    });
  }
}
