import { DealKind } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  ValidateNested,
} from 'class-validator';
import { RightsSelectionItemDto } from './rights-selection-item.dto';

export class CreateDealDto {
  @IsString()
  @Length(1, 500)
  title!: string;

  @IsOptional()
  @IsEnum(DealKind)
  kind?: DealKind;

  @IsUUID()
  buyerOrgId!: string;

  @IsUUID()
  ownerUserId!: string;

  @IsString()
  @Length(3, 3)
  currency!: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  catalogItemIds?: string[];

  @IsOptional()
  @IsString()
  commercialExpectedValue?: string;

  @IsOptional()
  @IsBoolean()
  vatIncluded?: boolean;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => RightsSelectionItemDto)
  rightsSelections?: RightsSelectionItemDto[];

  /** Обход блокировки конфликта прав (только admin; в проде — JWT). */
  @IsOptional()
  @IsBoolean()
  adminOverride?: boolean;
}
