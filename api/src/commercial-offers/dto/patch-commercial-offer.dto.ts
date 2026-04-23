import { IsBoolean } from 'class-validator';

export class PatchCommercialOfferDto {
  @IsBoolean()
  archived!: boolean;
}
