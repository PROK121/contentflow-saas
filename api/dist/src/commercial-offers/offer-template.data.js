"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.offerDtoToTemplateData = offerDtoToTemplateData;
const create_commercial_offer_dto_1 = require("./dto/create-commercial-offer.dto");
const DEFAULT_SEQUEL = 'Приоритетное право на приобретение прав на продолжение франшизы, спин-оффов (все связанные по сюжету истории). А также новые премьерные фильмы правообладателя.';
function offerDtoToTemplateData(dto) {
    const offerDateRu = new Date(dto.offerDate).toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
    const distributor = dto.distributorLine?.trim() || 'ТОО «Growix Content Group»';
    const territory = dto.territory?.trim() || 'Весь мир';
    const localization = dto.localization?.trim() ||
        'Языки/Форматы (дубляж / voice-over / субтитры)';
    const licenseTerm = dto.licenseTerm?.trim() || '5 лет с даты открытия прав';
    const sequel = dto.sequelFranchiseTerms?.trim() || DEFAULT_SEQUEL;
    const validityDays = String(dto.offerValidityDays ?? 7);
    const signLine = dto.signatoryPlaceholder?.trim() || '________________________';
    const rightsLead = dto.exclusivity === create_commercial_offer_dto_1.OfferExclusivityDto.exclusive
        ? 'Исключительные права'
        : dto.exclusivity === create_commercial_offer_dto_1.OfferExclusivityDto.co_exclusive
            ? 'Ко-эксклюзив'
            : 'Не исключительные права';
    const rightsParagraph = rightsLead;
    const parts = [];
    if (dto.promoSupport)
        parts.push('Промо поддержка');
    if (dto.catalogInclusion)
        parts.push('Добавление проекта в каталог компании ');
    if (dto.contractsAdmin) {
        parts.push('Заключение договоров, ведение документооборота, предоставление отчетности;');
    }
    if (dto.digitization)
        parts.push('Оцифровка материала ');
    const additionalConditions = parts.length > 0 ? parts.join(' ') : '\u00a0';
    const materialsNote = dto.materialsNote?.trim() || '\u00a0';
    return {
        offerDateRu,
        workTitle: dto.workTitle,
        distributorLine: distributor,
        contentTitle: dto.contentTitle,
        productionYear: dto.productionYear,
        contentFormat: dto.contentFormat,
        genre: dto.genre,
        seriesCount: dto.seriesCount,
        runtime: dto.runtime,
        theatricalRelease: dto.theatricalRelease,
        rightsHolder: dto.rightsHolder,
        contentLanguage: dto.contentLanguage,
        rightsParagraph,
        territory,
        localization,
        materialsNote,
        additionalConditions,
        licenseTerm,
        rightsOpeningProcedure: dto.rightsOpeningProcedure,
        remunerationKztNet: dto.remunerationKztNet,
        sequelFranchiseTerms: sequel,
        paymentSchedule: dto.paymentSchedule,
        offerValidityDays: validityDays,
        signatoryLine: signLine,
    };
}
//# sourceMappingURL=offer-template.data.js.map