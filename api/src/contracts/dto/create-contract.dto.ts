import { IsArray, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateContractDto {
  @IsUUID()
  dealId!: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  dealIds?: string[];

  @IsOptional()
  @IsString()
  templateId?: string;
}
