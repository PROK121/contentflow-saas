/** Общие поля и сборка тела POST /catalog/items (форма «Новый контент» и мастер сделки). */

import { formatAssetTypeLabel } from "./asset-type-labels";
import {
  dealTerritoryLabel,
  formatDealTerritoryCodes,
} from "./deal-territory-presets";
import { formatLicenseTermCell } from "./license-term-format";
import { transliterateCyrillicToLatin } from "./transliterate-cyrillic-latin";

export const CATALOG_ASSET_TYPES = [
  { value: "video", label: "Фильмы" },
  { value: "series", label: "Сериалы" },
  { value: "animated_series", label: "Анимационные сериалы" },
  { value: "animated_film", label: "Анимационные фильмы" },
  { value: "anime_series", label: "Анимэ (сериалы)" },
  { value: "anime_film", label: "Анимэ фильмы" },
  { value: "concert_show", label: "Концерты/Шоу" },
] as const;

/** Сериал / мультсериал / аниме-сериал — нужно количество серий. */
export const CATALOG_SERIES_LIKE_ASSET_TYPES = [
  "series",
  "animated_series",
  "anime_series",
] as const;

export function isSeriesLikeCatalogAssetType(assetType: string): boolean {
  return (CATALOG_SERIES_LIKE_ASSET_TYPES as readonly string[]).includes(
    assetType,
  );
}

export function readCatalogContentMeta(metadata: unknown): {
  runtime?: string;
  episodeCount?: number;
} {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }
  const o = metadata as Record<string, unknown>;
  const runtime = typeof o.runtime === "string" ? o.runtime : undefined;
  const ec = o.episodeCount;
  let episodeCount: number | undefined;
  if (typeof ec === "number" && Number.isFinite(ec)) {
    episodeCount = ec;
  } else if (typeof ec === "string" && /^\d+$/.test(ec)) {
    episodeCount = Number.parseInt(ec, 10);
  }
  return { runtime, episodeCount };
}

/** Расширенные поля карточки каталога для офферов и синхронизации. */
export function readCatalogOfferSourceMeta(metadata: unknown): {
  runtime?: string;
  episodeCount?: number;
  seasonCount?: number;
  productionYear?: string;
  countryOfProduction?: string;
  contentFormat?: string;
  genre?: string;
  ageRating?: string;
  localizationNeeded?: string;
  musicRightsStatus?: string;
  theatricalRelease?: string;
  distributorLine?: string;
  contentTitle?: string;
  premiereCategory?: string;
} {
  const base = readCatalogContentMeta(metadata);
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return base;
  }
  const o = metadata as Record<string, unknown>;
  const s = (k: string): string | undefined =>
    typeof o[k] === "string" ? (o[k] as string) : undefined;
  const n = (k: string): number | undefined => {
    const v = o[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && /^\d+$/.test(v)) return Number.parseInt(v, 10);
    return undefined;
  };
  return {
    ...base,
    seasonCount: n("seasonCount"),
    productionYear: s("productionYear"),
    countryOfProduction: s("countryOfProduction"),
    contentFormat: s("contentFormat"),
    genre: s("genre"),
    ageRating: s("ageRating"),
    localizationNeeded: s("localizationNeeded"),
    musicRightsStatus: s("musicRightsStatus"),
    theatricalRelease: s("theatricalRelease"),
    distributorLine: s("distributorLine"),
    contentTitle: s("contentTitle"),
    premiereCategory: s("premiereCategory"),
  };
}

export type CatalogItemMetadataExtras = {
  seasonCount?: string;
  productionYear?: string;
  countryOfProduction?: string;
  contentFormat?: string;
  genre?: string;
  ageRating?: string;
  localizationNeeded?: string;
  musicRightsStatus?: string;
  theatricalRelease?: string;
  distributorLine?: string;
  contentTitle?: string;
  premiereCategory?: string;
};

export const CATALOG_PREMIERE_CATEGORIES = [
  { value: "A", label: "A (high)" },
  { value: "B", label: "B (medium)" },
  { value: "C", label: "C (low)" },
] as const;

export function formatPremiereCategory(value: string | undefined): string {
  const v = (value ?? "").trim().toUpperCase();
  const row = CATALOG_PREMIERE_CATEGORIES.find((x) => x.value === v);
  return row?.label ?? "—";
}

/** Поля для POST /catalog/items.metadata */
export function buildCatalogItemMetadataForApi(
  assetType: string,
  runtime: string,
  episodeCount: string,
  extras?: CatalogItemMetadataExtras,
): Record<string, unknown> {
  const m: Record<string, unknown> = { runtime: runtime.trim() };
  if (extras?.seasonCount?.trim() && /^\d+$/.test(extras.seasonCount.trim())) {
    m.seasonCount = Number.parseInt(extras.seasonCount.trim(), 10);
  }
  if (isSeriesLikeCatalogAssetType(assetType)) {
    m.episodeCount = Number.parseInt(episodeCount.trim(), 10);
  }
  const pick = (v: string | undefined, key: string) => {
    const t = v?.trim();
    if (t) m[key] = t;
  };
  pick(extras?.productionYear, "productionYear");
  pick(extras?.countryOfProduction, "countryOfProduction");
  pick(extras?.contentFormat, "contentFormat");
  pick(extras?.genre, "genre");
  pick(extras?.ageRating, "ageRating");
  pick(extras?.localizationNeeded, "localizationNeeded");
  pick(extras?.musicRightsStatus, "musicRightsStatus");
  pick(extras?.theatricalRelease, "theatricalRelease");
  pick(extras?.distributorLine, "distributorLine");
  pick(extras?.contentTitle, "contentTitle");
  pick(extras?.premiereCategory, "premiereCategory");
  return m;
}

/** Чекбоксы в форме карточки контента и в мастере сделки (значения = enum Platform в API). */
export const CATALOG_PLATFORM_OPTIONS = [
  { value: "TV", label: "TV" },
  { value: "VOD", label: "VOD" },
  { value: "ShipIfec", label: "Ship rights / IFEC" },
  { value: "PublicRights", label: "Public rights" },
] as const;

/** Для чтения старых записей с OTT / Web / YouTube. */
export const LEGACY_PLATFORM_VALUES = ["OTT", "Web", "YouTube"] as const;

export const CATALOG_PLATFORM_VALUES = CATALOG_PLATFORM_OPTIONS.map(
  (o) => o.value,
) as readonly string[];

export function formatPlatformLabel(value: string): string {
  const map: Record<string, string> = {
    TV: "TV",
    VOD: "VOD",
    ShipIfec: "Ship rights / IFEC",
    PublicRights: "Public rights",
    OTT: "OTT",
    Web: "Web",
    YouTube: "YouTube",
  };
  return map[value] ?? value;
}

export const CATALOG_EXCLUSIVITY = [
  { value: "non_exclusive", label: "Не исключительные права" },
  { value: "co_exclusive", label: "Ко-эксклюзив" },
  { value: "exclusive", label: "Исключительные права" },
] as const;

/** Подпись формата лицензии для UI (в т.ч. значения вне формы каталога). */
export function formatExclusivityLabel(value: string): string {
  const u = value.trim();
  const row = CATALOG_EXCLUSIVITY.find((x) => x.value === u);
  if (row) return row.label;
  if (u.toLowerCase() === "sole") {
    return "Sole (исключительные права правообладателя)";
  }
  return value;
}

export type CatalogTermDraft = {
  territoryCode: string;
  exclusivity: string;
  platforms: string[];
  /** Лет (ввод в форме); в API уходит как durationMonths. */
  durationYears: string;
  languageRights: string;
};

export function suggestCatalogSlug(title: string): string {
  const translit = transliterateCyrillicToLatin(title.trim());
  const base = translit
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  return base || `item-${Date.now()}`;
}

export function defaultCatalogTerm(): CatalogTermDraft {
  return {
    territoryCode: "KZ",
    exclusivity: "non_exclusive",
    platforms: ["TV"],
    durationYears: "",
    languageRights: "original",
  };
}

/** Проверка перед POST /catalog/items: при непустом сообщении создавать карточку нельзя. */
export function validateCatalogItemCreateInput(input: {
  title: string;
  slug: string;
  assetType: string;
  rightsHolderOrgId: string;
  terms: CatalogTermDraft[];
  runtime: string;
  episodeCount: string;
}): string | null {
  if (!input.title.trim()) {
    return "Заполните название";
  }
  if (!input.slug.trim()) {
    return "Заполните slug или нажмите «Из названия»";
  }
  if (!CATALOG_ASSET_TYPES.some((a) => a.value === input.assetType)) {
    return "Выберите тип актива";
  }
  if (!input.rightsHolderOrgId.trim()) {
    return "Выберите правообладателя";
  }
  if (!input.runtime.trim()) {
    return "Укажите хронометраж";
  }
  if (input.runtime.trim().length > 500) {
    return "Хронометраж: не более 500 символов";
  }
  if (isSeriesLikeCatalogAssetType(input.assetType)) {
    const ep = input.episodeCount.trim();
    if (!ep) {
      return "Укажите количество серий";
    }
    const n = Number.parseInt(ep, 10);
    if (!/^[1-9]\d{0,4}$/.test(ep) || n < 1 || n > 99999) {
      return "Количество серий — целое число от 1 до 99999";
    }
  }
  for (let i = 0; i < input.terms.length; i++) {
    const t = input.terms[i];
    const n = i + 1;
    if (!t.territoryCode.trim()) {
      return `Лицензионная строка ${n}: укажите территорию`;
    }
    if (!t.platforms.length) {
      return `Лицензионная строка ${n}: выберите хотя бы одну платформу`;
    }
    if (!t.exclusivity?.trim()) {
      return `Лицензионная строка ${n}: укажите формат лицензии`;
    }
    const langs = t.languageRights
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!langs.length) {
      return `Лицензионная строка ${n}: укажите языки`;
    }
    const dy = t.durationYears.trim();
    if (dy) {
      const y = Number.parseFloat(dy.replace(",", "."));
      if (!Number.isFinite(y) || y <= 0) {
        return `Лицензионная строка ${n}: длительность в годах — положительное число`;
      }
    }
  }
  return null;
}

export function buildLicenseTermsForApi(terms: CatalogTermDraft[]) {
  return terms.map((t) => {
    const languageRights = t.languageRights
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    return {
      territoryCode: t.territoryCode.trim(),
      exclusivity: t.exclusivity,
      platforms: t.platforms.length ? t.platforms : ["TV"],
      durationMonths: t.durationYears.trim()
        ? Math.round(
            Number.parseFloat(t.durationYears.replace(",", ".")) * 12,
          )
        : undefined,
      sublicensingAllowed: false,
      languageRights: languageRights.length ? languageRights : ["original"],
    };
  });
}

/** Значение по умолчанию для поля «Общий лицензионный срок» в оффере. */
export const OFFER_DEFAULT_LICENSE_TERM =
  "5 лет с даты открытия прав";

export type CatalogLicenseTermLite = {
  territoryCode: string;
  startAt: string | null;
  endAt: string | null;
  durationMonths: number | null;
  languageRights?: string[];
};

/** Территории (подписи) и срок(и) лицензии из строк каталога → оффер. */
export function catalogToOfferTerritoryAndTerm(
  licenseTerms: CatalogLicenseTermLite[] | undefined | null,
): { territory: string; licenseTerm: string } {
  if (!licenseTerms?.length) {
    return { territory: "", licenseTerm: OFFER_DEFAULT_LICENSE_TERM };
  }
  const codes = [
    ...new Set(
      licenseTerms
        .map((t) => String(t.territoryCode ?? "").trim().toUpperCase())
        .filter(Boolean),
    ),
  ];
  const territory = codes.length ? formatDealTerritoryCodes(codes) : "";

  if (licenseTerms.length === 1) {
    const t = licenseTerms[0];
    const cell = formatLicenseTermCell(
      t.durationMonths,
      t.startAt,
      t.endAt,
    );
    return {
      territory,
      licenseTerm:
        cell && cell !== "—" ? cell : OFFER_DEFAULT_LICENSE_TERM,
    };
  }

  const parts = licenseTerms.map((t) => {
    const cell = formatLicenseTermCell(
      t.durationMonths,
      t.startAt,
      t.endAt,
    );
    const lab = dealTerritoryLabel(t.territoryCode);
    const c = cell && cell !== "—" ? cell : "—";
    return `${lab}: ${c}`;
  });
  const joined = parts.join("; ");
  const allEmpty = licenseTerms.every((t) => {
    const cell = formatLicenseTermCell(
      t.durationMonths,
      t.startAt,
      t.endAt,
    );
    return !cell || cell === "—";
  });
  return {
    territory,
    licenseTerm: allEmpty ? OFFER_DEFAULT_LICENSE_TERM : joined,
  };
}

/** Данные карточки каталога → поля оффера (без клиента, даты и пр.). */
export type CatalogItemForOfferSync = {
  title: string;
  assetType: string;
  metadata?: unknown;
  rightsHolder: { legalName: string };
  licenseTerms?: CatalogLicenseTermLite[];
};

export function catalogToOfferContentFields(
  item: CatalogItemForOfferSync,
): {
  workTitle: string;
  contentTitle: string;
  productionYear: string;
  contentFormat: string;
  genre: string;
  seriesCount: string;
  runtime: string;
  theatricalRelease: string;
  rightsHolder: string;
  distributorLine: string;
  territory: string;
  licenseTerm: string;
  contentLanguage: string;
} {
  const meta = readCatalogOfferSourceMeta(item.metadata);
  let ep =
    meta.episodeCount != null ? String(meta.episodeCount) : "";
  if (!ep && !isSeriesLikeCatalogAssetType(item.assetType)) {
    ep = "1";
  }
  const yearFallback = String(new Date().getFullYear());
  const { territory, licenseTerm } = catalogToOfferTerritoryAndTerm(
    item.licenseTerms,
  );

  // Собираем уникальные языки из всех лицензионных строк
  const langSet = new Set<string>();
  for (const t of item.licenseTerms ?? []) {
    for (const lang of t.languageRights ?? []) {
      if (lang.trim()) langSet.add(lang.trim());
    }
  }
  const contentLanguage = langSet.size > 0 ? [...langSet].join(", ") : "";

  return {
    workTitle: item.title,
    contentTitle: (meta.contentTitle?.trim() || item.title).trim(),
    productionYear: meta.productionYear?.trim() || yearFallback,
    contentFormat:
      meta.contentFormat?.trim() ||
      formatAssetTypeLabel(item.assetType) ||
      "",
    genre: meta.genre?.trim() || "—",
    seriesCount: ep,
    runtime: meta.runtime?.trim() || "—",
    theatricalRelease: meta.theatricalRelease?.trim() || "—",
    rightsHolder: item.rightsHolder?.legalName?.trim() ?? "",
    distributorLine: meta.distributorLine?.trim() ?? "",
    territory,
    licenseTerm,
    contentLanguage,
  };
}
