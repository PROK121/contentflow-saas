import { IsBoolean, IsOptional } from 'class-validator';

export class PatchContractDto {
  @IsOptional()
  @IsBoolean()
  archived?: boolean;
}
