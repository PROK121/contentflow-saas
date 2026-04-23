import { OrganizationType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
export declare class OrganizationsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    list(type?: OrganizationType): Prisma.PrismaPromise<{
        id: string;
        legalName: string;
        country: string;
        taxId: string | null;
        isResident: boolean;
        type: import(".prisma/client").$Enums.OrganizationType;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    create(dto: CreateOrganizationDto): Prisma.Prisma__OrganizationClient<{
        id: string;
        legalName: string;
        country: string;
        taxId: string | null;
        isResident: boolean;
        type: import(".prisma/client").$Enums.OrganizationType;
        createdAt: Date;
        updatedAt: Date;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
}
