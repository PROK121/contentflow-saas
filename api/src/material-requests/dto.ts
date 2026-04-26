import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { MaterialReviewStatus } from '@prisma/client';
import { MATERIAL_SLOTS } from './material-slots';

const ALLOWED_SLOT_KEYS = MATERIAL_SLOTS.map((s) => s.key);

export class CreateMaterialRequestDto {
  @IsString()
  @IsNotEmpty()
  catalogItemId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsIn(ALLOWED_SLOT_KEYS, { each: true })
  requestedSlots!: string[];

  @IsOptional()
  @IsDateString()
  dueAt?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(2_000)
  note?: string;
}

export class UpdateMaterialRequestDto {
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsIn(ALLOWED_SLOT_KEYS, { each: true })
  requestedSlots?: string[];

  @IsOptional()
  @IsDateString()
  dueAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  note?: string;
}

export class ReviewUploadDto {
  @IsEnum(MaterialReviewStatus)
  reviewStatus!: MaterialReviewStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  reviewerComment?: string;
}
