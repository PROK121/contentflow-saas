import { DealKind, DealStage } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  Length,
  ValidateNested,
} from 'class-validator';
import { RightsSelectionItemDto } from './rights-selection-item.dto';

export class UpdateDealDto {
  @IsOptional()
  @IsString()
  @Length(1, 500)
  title?: string;

  @IsOptional()
  @IsEnum(DealKind)
  kind?: DealKind;

  @IsOptional()
  @IsEnum(DealStage)
  stage?: DealStage;

  @IsOptional()
  @IsBoolean()
  archived?: boolean;

  @IsOptional()
  @IsObject()
  commercialSnapshotPatch?: Record<string, unknown>;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => RightsSelectionItemDto)
  rightsSelections?: RightsSelectionItemDto[];
}
