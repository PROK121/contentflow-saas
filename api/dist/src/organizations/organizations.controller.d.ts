import { OrganizationType } from '@prisma/client';
import { OrganizationsService } from './organizations.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
export declare class OrganizationsController {
    private readonly organizationsService;
    constructor(organizationsService: OrganizationsService);
    list(type?: OrganizationType): import(".prisma/client").Prisma.PrismaPromise<{
        id: string;
        legalName: string;
        country: string;
        taxId: string | null;
        isResident: boolean;
        type: import(".prisma/client").$Enums.OrganizationType;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    create(body: CreateOrganizationDto): import(".prisma/client").Prisma.Prisma__OrganizationClient<{
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
