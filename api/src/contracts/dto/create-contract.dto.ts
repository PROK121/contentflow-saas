import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateContractDto {
  @IsUUID()
  dealId!: string;

  @IsOptional()
  @IsString()
  templateId?: string;
}
