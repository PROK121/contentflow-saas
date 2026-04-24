/**
 * Shared date / time formatting utilities.
 * All functions are pure and safe to call with null/undefined.
 */

const LOCALE = "ru-RU";

/** "01.04.2025" — short date, used in tables and cards */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(LOCALE);
}

/** "01.04.2025, 14:32" — date + time, used in activity feeds and audit logs */
export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(LOCALE);
}

/** "апр 2025" — month + year, used in summaries */
export function fmtMonthYear(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(LOCALE, { month: "short", year: "numeric" });
}

/**
 * Relative label for recent dates:
 *   < 1 min  → "только что"
 *   < 1 hour → "N мин. назад"
 *   < 24 h   → "N ч. назад"
 *   otherwise → fmtDate
 */
export function fmtRelative(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const diffMs = Date.now() - d.getTime();
  if (diffMs < 60_000) return "только что";
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)} мин. назад`;
  if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)} ч. назад`;
  return fmtDate(iso);
}
