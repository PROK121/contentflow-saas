import { DealActivityKind } from '@prisma/client';
import {
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';

export class DealActivityDto {
  @IsEnum(DealActivityKind)
  kind!: DealActivityKind;

  @IsString()
  @Length(1, 4000)
  message!: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsUUID()
  userId?: string;
}
