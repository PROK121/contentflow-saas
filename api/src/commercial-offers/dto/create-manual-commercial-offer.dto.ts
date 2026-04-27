import { IsEnum, IsUUID } from 'class-validator';
import { OfferTemplateKindDto } from './create-commercial-offer.dto';

export enum ManualOfferStatusDto {
  on_review = 'on_review',
  agreed = 'agreed',
}

export class CreateManualCommercialOfferDto {
  @IsUUID()
  dealId!: string;

  @IsEnum(OfferTemplateKindDto)
  templateKind!: OfferTemplateKindDto;

  @IsEnum(ManualOfferStatusDto)
  status!: ManualOfferStatusDto;
}
