import { OrganizationType } from '@prisma/client';
export declare class CreateOrganizationDto {
    legalName: string;
    country: string;
    type: OrganizationType;
    taxId?: string;
    isResident?: boolean;
}
