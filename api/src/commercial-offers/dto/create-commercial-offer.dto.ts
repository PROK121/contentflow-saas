import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export enum OfferExclusivityDto {
  exclusive = 'exclusive',
  co_exclusive = 'co_exclusive',
  non_exclusive = 'non_exclusive',
}

export enum OfferTemplateKindDto {
  po = 'po',
  platforms = 'platforms',
}

/** Поля формы соответствуют шаблонам «Оффер для ПО» и «Оффер для Площадок». */
export class CreateCommercialOfferDto {
  /** Шаблон DOCX: правообладатель (ПО) или площадки. По умолчанию — ПО. */
  @IsOptional()
  @IsEnum(OfferTemplateKindDto)
  templateKind?: OfferTemplateKindDto;

  /** Организация-покупатель: должна фигурировать хотя бы в одной сделке. */
  @IsUUID()
  buyerOrgId!: string;

  @IsDateString()
  offerDate!: string;

  @IsString()
  @MaxLength(500)
  workTitle!: string;

  /** Юр. строка дистрибьютора, по умолчанию ТОО «Growix Content Group». */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  distributorLine?: string;

  @IsString()
  @MaxLength(500)
  contentTitle!: string;

  @IsString()
  @MaxLength(32)
  productionYear!: string;

  @IsString()
  @MaxLength(120)
  contentFormat!: string;

  @IsString()
  @MaxLength(200)
  genre!: string;

  @IsString()
  @MaxLength(64)
  seriesCount!: string;

  @IsString()
  @MaxLength(120)
  runtime!: string;

  @IsString()
  @MaxLength(500)
  theatricalRelease!: string;

  @IsString()
  @MaxLength(500)
  rightsHolder!: string;

  @IsString()
  @MaxLength(120)
  contentLanguage!: string;

  @IsEnum(OfferExclusivityDto)
  exclusivity!: OfferExclusivityDto;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  territory?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  localization?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  materialsNote?: string;

  @IsOptional()
  @IsBoolean()
  promoSupport?: boolean;

  @IsOptional()
  @IsBoolean()
  catalogInclusion?: boolean;

  @IsOptional()
  @IsBoolean()
  contractsAdmin?: boolean;

  @IsOptional()
  @IsBoolean()
  digitization?: boolean;

  /** Платформы (виды прав) — только для шаблона ПО */
  @IsOptional()
  @IsBoolean()
  platformTV?: boolean;

  @IsOptional()
  @IsBoolean()
  platformVOD?: boolean;

  @IsOptional()
  @IsBoolean()
  platformShipRights?: boolean;

  @IsOptional()
  @IsBoolean()
  platformPublicRights?: boolean;

  @IsOptional()
  @IsBoolean()
  sublicensing?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  licenseTerm?: string;

  @IsString()
  @MaxLength(4000)
  rightsOpeningProcedure!: string;

  @IsString()
  @MaxLength(2000)
  remunerationKztNet!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  sequelFranchiseTerms?: string;

  @IsString()
  @MaxLength(4000)
  paymentSchedule!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  offerValidityDays?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  signatoryPlaceholder?: string;
}
