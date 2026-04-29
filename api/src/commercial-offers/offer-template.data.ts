import { CreateCommercialOfferDto } from './dto/create-commercial-offer.dto';
import { OfferExclusivityDto } from './dto/create-commercial-offer.dto';

const DEFAULT_SEQUEL =
  'Приоритетное право на приобретение прав на продолжение франшизы, спин-оффов (все связанные по сюжету истории). А также новые премьерные фильмы правообладателя.';

export type OfferTemplateData = Record<string, string>;

export function offerDtoToTemplateData(
  dto: CreateCommercialOfferDto,
): OfferTemplateData {
  const offerDateRu = new Date(dto.offerDate).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const distributor =
    dto.distributorLine?.trim() || 'ТОО «Growix Content Group»';
  const territory = dto.territory?.trim() || 'Весь мир';
  const localization =
    dto.localization?.trim() ||
    'Языки/Форматы (дубляж / voice-over / субтитры)';
  const licenseTerm = dto.licenseTerm?.trim() || '5 лет с даты открытия прав';
  const sequel = dto.sequelFranchiseTerms?.trim() || DEFAULT_SEQUEL;
  const validityDays = String(dto.offerValidityDays ?? 7);
  const signLine =
    dto.signatoryPlaceholder?.trim() || '________________________';

  const rightsLead =
    dto.exclusivity === OfferExclusivityDto.exclusive
      ? 'Исключительные права'
      : dto.exclusivity === OfferExclusivityDto.co_exclusive
        ? 'Ко-эксклюзив'
        : 'Не исключительные права';
  const rightsParagraph = rightsLead;

  const parts: string[] = [];
  if (dto.promoSupport) parts.push('Промо поддержка');
  if (dto.catalogInclusion)
    parts.push('Добавление проекта в каталог компании ');
  if (dto.contractsAdmin) {
    parts.push(
      'Заключение договоров, ведение документооборота, предоставление отчетности;',
    );
  }
  if (dto.digitization) parts.push('Оцифровка материала ');
  const additionalConditions = parts.length > 0 ? parts.join(' ') : '\u00a0';

  const materialsNote = dto.materialsNote?.trim() || '\u00a0';

  // \u0412\u0438\u0434\u044b \u043f\u0440\u0430\u0432 (\u043f\u043b\u0430\u0442\u0444\u043e\u0440\u043c\u044b) \u2014 \u0442\u043e\u043b\u044c\u043a\u043e \u0434\u043b\u044f \u0448\u0430\u0431\u043b\u043e\u043d\u0430 \u041f\u041e
  const platformParts: string[] = [];
  if (dto.platformTV) platformParts.push('TV');
  if (dto.platformVOD) platformParts.push('VOD');
  if (dto.platformShipRights) platformParts.push('Ship rights / IFEC');
  if (dto.platformPublicRights) platformParts.push('Public rights');
  if (dto.sublicensing) platformParts.push('\u0421\u0443\u0431\u043b\u0438\u0446\u0435\u043d\u0437\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u0435 \u0440\u0430\u0437\u0440\u0435\u0448\u0435\u043d\u043e');
  const rightsPlatforms = platformParts.length > 0 ? platformParts.join(', ') : '\u00a0';

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
    rightsPlatforms,
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
