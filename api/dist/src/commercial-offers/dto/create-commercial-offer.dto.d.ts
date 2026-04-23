export declare enum OfferExclusivityDto {
    exclusive = "exclusive",
    co_exclusive = "co_exclusive",
    non_exclusive = "non_exclusive"
}
export declare enum OfferTemplateKindDto {
    po = "po",
    platforms = "platforms"
}
export declare class CreateCommercialOfferDto {
    templateKind?: OfferTemplateKindDto;
    buyerOrgId: string;
    offerDate: string;
    workTitle: string;
    distributorLine?: string;
    contentTitle: string;
    productionYear: string;
    contentFormat: string;
    genre: string;
    seriesCount: string;
    runtime: string;
    theatricalRelease: string;
    rightsHolder: string;
    contentLanguage: string;
    exclusivity: OfferExclusivityDto;
    territory?: string;
    localization?: string;
    materialsNote?: string;
    promoSupport?: boolean;
    catalogInclusion?: boolean;
    contractsAdmin?: boolean;
    digitization?: boolean;
    licenseTerm?: string;
    rightsOpeningProcedure: string;
    remunerationKztNet: string;
    sequelFranchiseTerms?: string;
    paymentSchedule: string;
    offerValidityDays?: number;
    signatoryPlaceholder?: string;
}
