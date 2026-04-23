import { CreateCommercialOfferDto } from './dto/create-commercial-offer.dto';
export type OfferTemplateVariant = 'po' | 'platforms';
export declare function renderOfferDocxFromDto(dto: CreateCommercialOfferDto, variant?: OfferTemplateVariant): Buffer;
export declare function renderOfferPdfFromDto(dto: CreateCommercialOfferDto, variant?: OfferTemplateVariant): Promise<Buffer>;
