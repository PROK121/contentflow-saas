import { PaymentStatus } from '@prisma/client';
import { IsBoolean, IsDateString, IsEnum, IsOptional } from 'class-validator';

export class UpdatePaymentDto {
  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @IsOptional()
  @IsDateString()
  paidAt?: string;

  /** Сбросить дату оплаты (например при возврате в «ожидает») */
  @IsOptional()
  @IsBoolean()
  paidAtClear?: boolean;
}
