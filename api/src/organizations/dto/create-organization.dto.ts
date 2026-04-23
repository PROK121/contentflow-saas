import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';
import { OrganizationType } from '@prisma/client';

export class CreateOrganizationDto {
  @IsString()
  @Length(1, 500)
  legalName!: string;

  @IsString()
  @Length(2, 2)
  country!: string;

  @IsEnum(OrganizationType)
  type!: OrganizationType;

  @IsOptional()
  @IsString()
  taxId?: string;

  @IsOptional()
  @IsBoolean()
  isResident?: boolean;
}
