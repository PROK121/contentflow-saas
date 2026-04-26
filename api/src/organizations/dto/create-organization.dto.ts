import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';
import { OrganizationType } from '@prisma/client';

export class CreateOrganizationDto {
  @IsString()
  @Length(1, 500)
  legalName!: string;

  @IsString()
  @Length(2, 2)
  country!: string;

  @IsEnum(OrganizationType)
  type!: OrganizationType;

  @IsOptional()
  @IsString()
  taxId?: string;

  @IsOptional()
  @IsBoolean()
  isResident?: boolean;

  // --- Доп. поля площадки (хранятся в metadata JSON) ---

  /** Основные языки контента */
  @IsOptional()
  @IsString()
  primaryLanguages?: string;

  /** Предпочитаемые жанры */
  @IsOptional()
  @IsString()
  preferredGenres?: string;

  /** Готовность к эксклюзиву */
  @IsOptional()
  @IsString()
  exclusivityReadiness?: string;

  /** Предпочтительный срок лицензии */
  @IsOptional()
  @IsString()
  preferredTerm?: string;

  /** Средний бюджет на контент */
  @IsOptional()
  @IsString()
  averageBudget?: string;

  /** Платежная дисциплина */
  @IsOptional()
  @IsString()
  paymentDiscipline?: string;

  /** Технические требования к файлам */
  @IsOptional()
  @IsString()
  techRequirements?: string;

  /** Основной контакт (ФИО) */
  @IsOptional()
  @IsString()
  contactName?: string;

  /** Эл. почта контакта */
  @IsOptional()
  @IsString()
  contactEmail?: string;

  /** Телефон контакта */
  @IsOptional()
  @IsString()
  contactPhone?: string;

  /** Примечания */
  @IsOptional()
  @IsString()
  notes?: string;
}
