import { Exclusivity, Platform } from '@prisma/client';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateLicenseTermDto {
  @IsString()
  territoryCode!: string;

  @IsOptional()
  @IsDateString()
  startAt?: string;

  @IsOptional()
  @IsDateString()
  endAt?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  durationMonths?: number;

  @IsEnum(Exclusivity)
  exclusivity!: Exclusivity;

  @IsArray()
  @IsEnum(Platform, { each: true })
  platforms!: Platform[];

  @IsOptional()
  @IsBoolean()
  sublicensingAllowed?: boolean;

  @IsArray()
  @IsString({ each: true })
  languageRights!: string[];
}
