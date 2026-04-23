import { CreateCommercialOfferDto } from './dto/create-commercial-offer.dto';
export type OfferTemplateData = Record<string, string>;
export declare function offerDtoToTemplateData(dto: CreateCommercialOfferDto): OfferTemplateData;
