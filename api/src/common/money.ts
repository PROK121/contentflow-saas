import { Decimal } from '@prisma/client/runtime/library';

/// Деньги — это `Decimal` от Prisma (под капотом decimal.js, аналог BigDecimal).
/// JS-Number теряет точность при значениях вне 2^53; для копеек в больших суммах
/// это критично. Поэтому весь финансовый код в проекте обязан проходить
/// через утилиты ниже.
///
/// Контракт ввода: на вход принимаем `string | number | Decimal | null | undefined`,
/// нормализуем (заменяя «,», убирая пробелы и неразрывные пробелы), парсим в
/// `Decimal`. На выходе — всегда `Decimal`, который сериализуется в JSON через
/// `.toString()` (см. SerializeInterceptor / serialize-for-json).

export type MoneyInput = string | number | Decimal | null | undefined;

const NBSP = / /g;

/// Нормализует строку: «100 000,50» → «100000.50». Возвращает trimmed-строку
/// без локализованных разделителей разрядов.
function normalizeMoneyString(raw: string): string {
  return raw
    .trim()
    .replace(NBSP, '')
    .replace(/\s+/g, '')
    .replace(/,/g, '.');
}

/// Парсит произвольный денежный ввод в Decimal. Бросает Error при некорректном
/// значении — это нужно поймать в контроллере и вернуть 400.
export function toDecimal(input: MoneyInput): Decimal {
  if (input == null) return new Decimal(0);
  if (input instanceof Decimal) return input;
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) {
      throw new Error(`Invalid money number: ${input}`);
    }
    return new Decimal(input);
  }
  const normalized = normalizeMoneyString(input);
  if (normalized === '') return new Decimal(0);
  // Decimal сам бросит на нечисло — обернём для понятного сообщения.
  try {
    return new Decimal(normalized);
  } catch {
    throw new Error(`Invalid money string: "${input}"`);
  }
}

/// Безопасный «или ноль» — для агрегаций, где отсутствие значения равно 0.
export function toDecimalOrZero(input: MoneyInput): Decimal {
  try {
    return toDecimal(input);
  } catch {
    return new Decimal(0);
  }
}

/// Сумма произвольного списка денежных значений. Любые невалидные элементы
/// игнорируются и логируются вызывающим (тут только число, без логов).
export function sumDecimal(values: MoneyInput[]): Decimal {
  let acc: Decimal = new Decimal(0);
  for (const v of values) {
    acc = acc.plus(toDecimalOrZero(v));
  }
  return acc;
}

/// Округление до количества знаков после запятой (по умолчанию 2 — копейки).
/// Используется для финального сохранения в БД, где `Decimal(18,2)`.
export function roundDecimal(d: Decimal, places = 2): Decimal {
  return d.toDecimalPlaces(places, Decimal.ROUND_HALF_UP);
}

/// Безопасное умножение на коэффициент (например, percent/100).
export function mulDecimal(a: MoneyInput, b: MoneyInput): Decimal {
  return toDecimal(a).mul(toDecimal(b));
}

/// Процент от суммы. `percent` ожидаем в формате «10» = 10%.
export function percentOf(base: MoneyInput, percent: MoneyInput): Decimal {
  return mulDecimal(base, toDecimal(percent).div(100));
}

/// Строковая сериализация для JSON-ответов. Применять перед отдачей наружу,
/// чтобы клиент получил «100.50», а не объект Decimal.
export function moneyToString(d: Decimal | null | undefined): string | null {
  if (d == null) return null;
  return d.toFixed();
}

/// Проверка корректности строки-деньги без бросания исключения. Удобно
/// в DTO/валидаторах.
export function isValidMoneyInput(input: MoneyInput): boolean {
  try {
    toDecimal(input);
    return true;
  } catch {
    return false;
  }
}
