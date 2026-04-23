import { Type } from 'class-transformer';
import { CatalogItemStatus } from '@prisma/client';
import {
  IsArray,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  Length,
  ValidateNested,
} from 'class-validator';
import { CreateLicenseTermDto } from './create-license-term.dto';

export class UpdateCatalogItemDto {
  @IsOptional()
  @IsString()
  @Length(1, 500)
  title?: string;

  @IsOptional()
  @IsEnum(CatalogItemStatus)
  status?: CatalogItemStatus;

  /** Поверхностное слияние в JSON metadata (год, жанр, оффер-поля и т.д.). */
  @IsOptional()
  @IsObject()
  metadataPatch?: Record<string, unknown>;

  /** Полная замена лицензионных строк карточки. */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateLicenseTermDto)
  licenseTerms?: CreateLicenseTermDto[];
}
