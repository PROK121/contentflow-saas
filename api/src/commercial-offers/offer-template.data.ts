import { CreateCommercialOfferDto, TitleItemDto } from './dto/create-commercial-offer.dto';
import { OfferExclusivityDto } from './dto/create-commercial-offer.dto';

const DEFAULT_SEQUEL =
  'Приоритетное право на приобретение прав на продолжение франшизы, спин-оффов (все связанные по сюжету истории). А также новые премьерные фильмы правообладателя.';

export type OfferTemplateData = Record<string, string>;

export type PackageTitleRow = {
  rowNum: string;
  title: string;
  seriesCount: string;
  genre: string;
  runtime: string;
  productionYear: string;
  theatricalRelease: string;
  language: string;
  price: string;
};

export type PackageTemplateData = Record<string, string | PackageTitleRow[]>;

function normalizePackageProductionYear(raw: string): string {
  const value = raw.trim();
  if (!value) return '';
  const years = Array.from(
    new Set((value.match(/\b(19|20)\d{2}\b/g) ?? []).map(Number)),
  );
  if (years.length === 0) return value;
  if (years.length === 1) return String(years[0]);
  const min = Math.min(...years);
  const max = Math.max(...years);
  return `${min}-${max}`;
}

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

  // Дополнительные условия — через запятую
  const parts: string[] = [];
  if (dto.promoSupport) parts.push('Промо поддержка');
  if (dto.catalogInclusion) parts.push('Добавление проекта в каталог компании');
  if (dto.contractsAdmin) parts.push('Заключение договоров, ведение документооборота, предоставление отчетности');
  if (dto.digitization) parts.push('Оцифровка материала');
  const additionalConditions = parts.length > 0 ? parts.join(', ') : ' ';

  const materialsNote = dto.materialsNote?.trim() || ' ';

  // Виды прав — фиксированный текст
  const rightsPlatforms =
    'права на сублицензию третьим лицам следующих прав: VOD (AVOD, SVOD, FVOD, PVOD, TVOD, EST), телевизионные права: эфирное (Free TV) и платное телевидение (Pay TV), IPTV, shipping rights: на показ в мультимедийных устройствах перевозчиков, право промоутирования';

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

/** Формирует данные для шаблона «Пакет площадок» (platforms_package). */
export function offerDtoToPackageTemplateData(
  dto: CreateCommercialOfferDto,
  clientLegalName: string,
): PackageTemplateData {
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
  const validityDays = String(dto.offerValidityDays ?? 7);
  const signLine =
    dto.signatoryPlaceholder?.trim() || '________________________';
  const materialsNote = dto.materialsNote?.trim() || ' ';

  const rightsLead =
    dto.exclusivity === OfferExclusivityDto.exclusive
      ? 'Исключительные права'
      : dto.exclusivity === OfferExclusivityDto.co_exclusive
        ? 'Ко-эксклюзив'
        : 'Не исключительные права';

  const parts: string[] = [];
  if (dto.promoSupport) parts.push('Промо поддержка');
  if (dto.catalogInclusion) parts.push('Добавление проекта в каталог компании');
  if (dto.contractsAdmin)
    parts.push(
      'Заключение договоров, ведение документооборота, предоставление отчетности',
    );
  if (dto.digitization) parts.push('Оцифровка материала');
  const additionalConditions = parts.length > 0 ? parts.join(', ') : ' ';

  const rightsPlatforms =
    'права на сублицензию третьим лицам следующих прав: VOD (AVOD, SVOD, FVOD, PVOD, TVOD, EST), телевизионные права: эфирное (Free TV) и платное телевидение (Pay TV), IPTV, shipping rights: на показ в мультимедийных устройствах перевозчиков, право промоутирования';

  const titleRows: PackageTitleRow[] = (dto.titles ?? []).map(
    (t: TitleItemDto, i: number) => ({
      rowNum: String(i + 1),
      title: t.title,
      seriesCount: t.seriesCount,
      genre: t.genre,
      runtime: t.runtime,
      productionYear: normalizePackageProductionYear(t.productionYear),
      theatricalRelease: t.theatricalRelease,
      language: t.language,
      price: t.price,
    }),
  );

  return {
    offerDateRu,
    workTitle: dto.workTitle,
    distributorLine: distributor,
    clientLegalName,
    titles: titleRows,
    rightsParagraph: rightsLead,
    rightsPlatforms,
    territory,
    localization,
    additionalConditions,
    licenseTerm,
    rightsOpeningProcedure: dto.rightsOpeningProcedure,
    remunerationKztNet: dto.remunerationKztNet,
    materialsNote,
    paymentSchedule: dto.paymentSchedule,
    offerValidityDays: validityDays,
    signatoryLine: signLine,
  };
}
