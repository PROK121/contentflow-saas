import { Exclusivity, Platform } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export class RightsSelectionItemDto {
  @IsUUID()
  catalogItemId!: string;

  @IsArray()
  @IsString({ each: true })
  territoryCodes!: string[];

  @IsOptional()
  @IsString()
  startAt?: string;

  @IsOptional()
  @IsString()
  endAt?: string;

  @IsArray()
  @IsEnum(Platform, { each: true })
  platforms!: Platform[];

  @IsEnum(Exclusivity)
  exclusivity!: Exclusivity;
}

export class SoldHintsDto {
  @IsArray()
  @IsUUID('4', { each: true })
  catalogItemIds!: string[];
}

export class ValidateRightsDto {
  @IsUUID()
  catalogItemId!: string;

  @ValidateNested()
  @Type(() => RightsSelectionItemDto)
  selection!: RightsSelectionItemDto;

  @IsOptional()
  @IsUUID()
  excludeDealId?: string;

  /** В проде заменить на проверку роли из JWT. */
  @IsOptional()
  @IsBoolean()
  adminOverride?: boolean;
}
