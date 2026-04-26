import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateInviteDto {
  @IsString()
  @IsNotEmpty()
  organizationId!: string;

  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  note?: string;
}

export class ClaimInviteDto {
  /// Сырой токен из ссылки в письме (без хеширования).
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  token!: string;

  /// Пароль ≥ 8 символов. Можно null, если правообладатель выбрал
  /// «вход только по magic-link». В этом случае поле опускается.
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  displayName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  @Matches(/^[+0-9 ()\-]+$/, {
    message: 'Телефон должен содержать только цифры, пробелы, скобки и знак +',
  })
  phone?: string;

  /// Принять условия использования — обязательно. Передаётся версия,
  /// показанная пользователю, чтобы можно было потом потребовать пересогласие.
  @IsString()
  @IsNotEmpty()
  acceptedTermsVersion!: string;
}

export class RequestMagicLinkDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  /// Опциональный путь для редиректа после входа. Должен начинаться с `/holder`.
  /// Используется кнопкой «Продолжить с телефона» — после входа пользователь
  /// попадает ровно на ту страницу, где сгенерировал QR.
  @IsOptional()
  @IsString()
  @MaxLength(512)
  redirect?: string;
}

export class VerifyMagicLinkDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  token!: string;
}
