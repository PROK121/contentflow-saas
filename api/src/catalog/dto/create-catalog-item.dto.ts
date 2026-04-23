import { AssetType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  ValidateNested,
} from 'class-validator';
import { CreateLicenseTermDto } from './create-license-term.dto';

export class CreateCatalogItemDto {
  @IsString()
  @Length(1, 500)
  title!: string;

  @IsString()
  @Length(1, 200)
  slug!: string;

  @IsEnum(AssetType)
  assetType!: AssetType;

  @IsUUID()
  rightsHolderOrgId!: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateLicenseTermDto)
  licenseTerms!: CreateLicenseTermDto[];
}
