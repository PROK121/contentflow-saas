import {
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class ExportBuyerCatalogDto {
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  catalogItemIds?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  q?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  assetType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  status?: string;

  @IsOptional()
  @IsString()
  @IsUUID('4')
  rightsHolderOrgId?: string;
}
