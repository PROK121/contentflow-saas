/** Отображение срока лицензии: годы вместо месяцев в UI; для дат — длительность в годах рядом. */

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

function parseIsoDateBoundary(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function pluralYearsRu(n: number): string {
  const nAbs = Math.abs(Math.trunc(n));
  const mod10 = nAbs % 10;
  const mod100 = nAbs % 100;
  if (mod100 >= 11 && mod100 <= 14) return "лет";
  if (mod10 === 1) return "год";
  if (mod10 >= 2 && mod10 <= 4) return "года";
  return "лет";
}

/** Целое число лет с правильным склонением; дробное — «X,XX лет». */
export function formatYearsRu(y: number): string {
  if (!Number.isFinite(y)) return "—";
  const rounded2 = Math.round(y * 100) / 100;
  const isWhole =
    Math.abs(rounded2 - Math.round(rounded2)) < 1e-6 ||
    Math.abs(rounded2 - Math.trunc(rounded2)) < 1e-6;
  if (isWhole) {
    const n = Math.round(rounded2);
    return `${n} ${pluralYearsRu(n)}`;
  }
  const s = rounded2
    .toFixed(2)
    .replace(/\.?0+$/, "")
    .replace(".", ",");
  return `${s} лет`;
}

/** Месяцы из БД → отображение в годах. */
export function formatLicenseYearsFromMonths(
  months: number | null | undefined,
): string {
  if (months == null || !Number.isFinite(months)) return "—";
  return formatYearsRu(months / 12);
}

function formatApproxYearsDecimal(y: number): string {
  const x = Math.round(y * 100) / 100;
  const s = x.toFixed(2).replace(/\.?0+$/, "").replace(".", ",");
  return `≈ ${s} лет`;
}

/** Диапазон дат (YYYY-MM-DD) + сколько это примерно в годах. */
export function formatIsoDateRangeWithYears(
  startIso: string | null | undefined,
  endIso: string | null | undefined,
): string {
  if (!startIso?.trim() && !endIso?.trim()) return "—";
  const d0 = startIso ? parseIsoDateBoundary(startIso) : null;
  const d1 = endIso ? parseIsoDateBoundary(endIso) : null;
  if (d0 && d1) {
    const ms = d1.getTime() - d0.getTime();
    const range = `${String(startIso).slice(0, 10)}–${String(endIso).slice(0, 10)}`;
    if (ms < 0) return range;
    const years = ms / MS_PER_YEAR;
    return `${range} (${formatApproxYearsDecimal(years)})`;
  }
  if (d0) return String(startIso).slice(0, 10);
  if (d1) return String(endIso).slice(0, 10);
  return "—";
}

/** Одна строка для ячейки «Срок»: длительность в годах или период с расчётом в годах. */
export function formatLicenseTermCell(
  durationMonths: number | null | undefined,
  startAt: string | null | undefined,
  endAt: string | null | undefined,
): string {
  if (durationMonths != null && Number.isFinite(durationMonths)) {
    return formatLicenseYearsFromMonths(durationMonths);
  }
  if (startAt && endAt) {
    return formatIsoDateRangeWithYears(startAt, endAt);
  }
  if (startAt || endAt) {
    return String(startAt || endAt).slice(0, 10);
  }
  return "—";
}

/** Подсказка под полями дат: только если обе даты заданы и конец ≥ начала. */
export function formatDateRangeYearsHint(
  startIso: string | null | undefined,
  endIso: string | null | undefined,
): string | null {
  if (!startIso?.trim() || !endIso?.trim()) return null;
  const d0 = parseIsoDateBoundary(startIso);
  const d1 = parseIsoDateBoundary(endIso);
  if (!d0 || !d1) return null;
  const ms = d1.getTime() - d0.getTime();
  if (ms < 0) return null;
  return formatApproxYearsDecimal(ms / MS_PER_YEAR);
}
