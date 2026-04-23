/** Группировка тысяч и дробная часть в стиле ru-RU (пробел как разряд). */

const displayFmt = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
  useGrouping: true,
});

function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  let s = String(value).trim().replace(/\u00a0/g, " ");
  if (!s) return null;
  s = s.replace(/\s/g, "");
  const neg = s.startsWith("-");
  if (neg) s = s.slice(1);
  s = s.replace(/[^0-9.,]/g, "");
  if (!s) return null;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  let norm = s;
  if (lastComma !== -1 && lastDot !== -1) {
    norm =
      lastComma > lastDot
        ? s.replace(/\./g, "").replace(",", ".")
        : s.replace(/,/g, "");
  } else if (lastComma !== -1) {
    norm = /,\d{1,2}$/.test(s) ? s.replace(",", ".") : s.replace(/,/g, "");
  }
  const n = parseFloat(norm);
  if (!Number.isFinite(n)) return null;
  return neg ? -n : n;
}

/** Отображение суммы; пустое / нечисловое → «—» (или исходная строка, если не распарсилось). */
export function formatMoneyAmount(
  value: string | number | null | undefined,
): string {
  const n = toNumber(value);
  if (n === null) {
    if (
      value === null ||
      value === undefined ||
      String(value).trim() === ""
    ) {
      return "—";
    }
    return String(value);
  }
  return displayFmt.format(n);
}

/** Как `formatMoneyAmount`, но для полей ввода: пусто остаётся пустым. */
export function formatMoneyAmountOrEmpty(
  value: string | number | null | undefined,
): string {
  const s = value === null || value === undefined ? "" : String(value).trim();
  if (!s) return "";
  const n = toNumber(s);
  if (n === null) return s;
  return displayFmt.format(n);
}

/** Строка для API (без пробелов, без группировки). */
export function normalizeMoneyInput(input: string): string {
  const n = toNumber(input);
  if (n === null) return input.trim().replace(/\s/g, "").replace(/\u00a0/g, "");
  if (Number.isInteger(n)) return String(Math.trunc(n));
  return String(n);
}

export function moneyValuesEqual(stored: unknown, input: string): boolean {
  const a =
    typeof stored === "number" || typeof stored === "string"
      ? toNumber(stored)
      : stored == null
        ? null
        : toNumber(String(stored));
  const b = toNumber(input);
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return Math.abs(a - b) < 1e-9;
}

export function parseMoneyNumber(
  value: string | number | null | undefined,
): number | null {
  return toNumber(value);
}
