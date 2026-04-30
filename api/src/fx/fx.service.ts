import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';

/// Настраиваемые источники курсов. `CBR` — ЦБ РФ (XML по дате),
/// `NBK` — Национальный банк Казахстана (XML), `ECB` — European Central Bank.
/// Реальные адаптеры подменяются env-переменной `FX_SOURCE`. Для dev по
/// умолчанию `CBR`.
export type FxSource = 'CBR' | 'NBK' | 'ECB';

interface CachedRate {
  rate: Decimal;
  source: FxSource;
  fetchedAt: Date;
}

/// Кеш курсов внутри инстанса. БД-кеш в `FxRateCache` — на сутки;
/// in-memory — на минуту, чтобы один и тот же расчёт сделок в рамках
/// одного импорта не дёргал внешний API.
const MEM_TTL_MS = 60 * 1000;
const DB_TTL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class FxService {
  private readonly logger = new Logger(FxService.name);
  private readonly source: FxSource;
  private memCache = new Map<string, { value: CachedRate; expiresAt: number }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const raw = (config.get<string>('FX_SOURCE') || 'CBR').toUpperCase();
    if (raw === 'CBR' || raw === 'NBK' || raw === 'ECB') {
      this.source = raw;
    } else {
      this.logger.warn(
        `Unknown FX_SOURCE="${raw}"; falling back to CBR`,
      );
      this.source = 'CBR';
    }
  }

  /// Получить курс «1 base = X quote» с кешем. Алгоритм:
  ///   1) memory-кеш (60 сек) — для одного запроса/импорта;
  ///   2) `FxRateCache` (24 часа) — между перезапусками;
  ///   3) внешний API источника (CBR/NBK/ECB) — если кеш пуст.
  ///
  /// Если внешний API недоступен и нет ни одного валидного кеша — бросаем
  /// `Error`. Применяющий код решает, фоллбечиться или фейлить операцию.
  async getRate(baseCurrency: string, quoteCurrency: string): Promise<Decimal> {
    const base = baseCurrency.toUpperCase();
    const quote = quoteCurrency.toUpperCase();
    if (base === quote) return new Decimal(1);

    const memKey = `${base}|${quote}|${this.source}`;
    const now = Date.now();
    const memHit = this.memCache.get(memKey);
    if (memHit && memHit.expiresAt > now) {
      return memHit.value.rate;
    }

    // 2) DB-кеш на сутки
    const dbCutoff = new Date(now - DB_TTL_MS);
    const dbHit = await this.prisma.fxRateCache.findFirst({
      where: {
        baseCurrency: base,
        quoteCurrency: quote,
        source: this.source,
        fetchedAt: { gte: dbCutoff },
      },
      orderBy: { fetchedAt: 'desc' },
    });
    if (dbHit) {
      const rate = new Decimal(dbHit.rate);
      this.memCache.set(memKey, {
        value: { rate, source: this.source, fetchedAt: dbHit.fetchedAt },
        expiresAt: now + MEM_TTL_MS,
      });
      return rate;
    }

    // 3) Внешний API. В этой версии — заглушки/best-effort: реальные парсеры
    //    добавляются по мере выбора пары. Если адаптер не реализован, бросаем
    //    с понятным сообщением, чтобы юрист/админ забил курс вручную в БД.
    try {
      const fetched = await this.fetchFromSource(base, quote);
      const saved = await this.prisma.fxRateCache.create({
        data: {
          baseCurrency: base,
          quoteCurrency: quote,
          source: this.source,
          rate: fetched,
        },
      });
      this.memCache.set(memKey, {
        value: { rate: fetched, source: this.source, fetchedAt: saved.fetchedAt },
        expiresAt: now + MEM_TTL_MS,
      });
      return fetched;
    } catch (e) {
      this.logger.error(
        `FX fetch failed (${this.source} ${base}->${quote}): ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
      // Последняя попытка — взять любой курс из БД, даже устаревший.
      const stale = await this.prisma.fxRateCache.findFirst({
        where: { baseCurrency: base, quoteCurrency: quote },
        orderBy: { fetchedAt: 'desc' },
      });
      if (stale) {
        this.logger.warn(
          `Using stale FX rate (${this.source} ${base}->${quote}) from ${stale.fetchedAt.toISOString()}`,
        );
        return new Decimal(stale.rate);
      }
      throw new Error(
        `Курс ${base}/${quote} недоступен (источник ${this.source}). Задайте вручную в FxRateCache или проверьте доступность API.`,
      );
    }
  }

  /// Фетч из внешнего источника. Каждый адаптер — async-метод, добавляется
  /// по мере необходимости. На момент каркаса все адаптеры — заглушки и
  /// бросают «not implemented»; администратор может либо реализовать, либо
  /// заранее заполнить FxRateCache из админки.
  private async fetchFromSource(
    base: string,
    quote: string,
  ): Promise<Decimal> {
    switch (this.source) {
      case 'CBR':
        return this.fetchCbr(base, quote);
      case 'NBK':
        return this.fetchNbk(base, quote);
      case 'ECB':
        return this.fetchEcb(base, quote);
      default:
        throw new Error(`Unknown FX source: ${this.source}`);
    }
  }

  /// ЦБ РФ публикует XML с курсами всех валют на дату:
  /// https://www.cbr.ru/scripts/XML_daily.asp?date_req=DD/MM/YYYY
  /// (без параметра — текущая дата). Кодировка windows-1251.
  ///
  /// Поддерживаются пары: X→RUB напрямую (X — любая валюта, перечисленная в
  /// XML, например USD/EUR/CNY/KZT), и RUB→X через инверсию. Кросс-курсы
  /// (USD→KZT, EUR→KZT и т.п.) считаются как X→RUB / Y→RUB. Это удобно для
  /// российских клиентов: основная пара RUB всегда доступна.
  private async fetchCbr(base: string, quote: string): Promise<Decimal> {
    const xml = await fetchCbrDailyXml();
    const rates = parseCbrXml(xml);
    return computeCrossRate(rates, base, quote, 'RUB');
  }

  /// НБК публикует XML на https://nationalbank.kz/rss/get_rates.cfm?fdate=DD.MM.YYYY
  /// Базовая валюта котировок — KZT, аналогично CBR строим X→KZT / Y→KZT.
  private async fetchNbk(base: string, quote: string): Promise<Decimal> {
    const xml = await fetchNbkDailyXml();
    const rates = parseNbkXml(xml);
    return computeCrossRate(rates, base, quote, 'KZT');
  }

  /// ECB публикует XML на https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml
  /// Базовая валюта — EUR.
  private async fetchEcb(base: string, quote: string): Promise<Decimal> {
    const xml = await fetchEcbDailyXml();
    const rates = parseEcbXml(xml);
    return computeCrossRate(rates, base, quote, 'EUR');
  }
}

// ===========================================================================
// HTTP + парсинг XML — отдельные функции, чтобы их можно было замокать в тестах
// ===========================================================================

/// Скачивает XML по URL c таймаутом 10 сек. Возвращает строку (text).
/// Кодировку проставляет вызывающий парсер — у CBR это windows-1251,
/// у ECB/NBK — utf-8.
async function fetchUrlAsBuffer(url: string): Promise<Buffer> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'ContentFlow/1.0 (+fx)' },
    });
    if (!res.ok) {
      throw new Error(`FX HTTP ${res.status} ${res.statusText} for ${url}`);
    }
    const arr = new Uint8Array(await res.arrayBuffer());
    return Buffer.from(arr);
  } finally {
    clearTimeout(timer);
  }
}

async function fetchCbrDailyXml(): Promise<string> {
  // У CBR XML в кодировке windows-1251. В Node 18+ TextDecoder это умеет.
  const buf = await fetchUrlAsBuffer(
    'https://www.cbr.ru/scripts/XML_daily.asp',
  );
  try {
    return new TextDecoder('windows-1251').decode(buf);
  } catch {
    // Если ICU не подгружен (минимальный node-image), fallback в utf-8 —
    // числа всё равно ASCII, кириллица в Name мы не используем.
    return buf.toString('utf8');
  }
}

async function fetchNbkDailyXml(): Promise<string> {
  const buf = await fetchUrlAsBuffer(
    'https://nationalbank.kz/rss/get_rates.cfm',
  );
  return buf.toString('utf8');
}

async function fetchEcbDailyXml(): Promise<string> {
  const buf = await fetchUrlAsBuffer(
    'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml',
  );
  return buf.toString('utf8');
}

/// Минималистичные XML-парсеры на регулярках. Это устойчивее, чем тянуть
/// `xml2js`/`fast-xml-parser` ради трёх стабильных форматов с предсказуемой
/// разметкой. Если завтра ЦБ поменяет формат — поправим тут локально.

interface RateRow {
  /// ISO-код валюты («USD», «EUR», ...).
  code: string;
  /// Сколько единиц валюты в одной строке (Nominal у CBR/NBK, у ECB всегда 1).
  nominal: number;
  /// Курс одной строки в базовой валюте (RUB у CBR, KZT у NBK, EUR у ECB).
  value: Decimal;
}

/// Парсит CBR XML формата
/// `<Valute><CharCode>USD</CharCode><Nominal>1</Nominal><Value>92,5000</Value></Valute>`.
/// Десятичная запятая — заменяем на точку для Decimal.
function parseCbrXml(xml: string): RateRow[] {
  const rows: RateRow[] = [];
  const re = /<Valute[^>]*>[\s\S]*?<\/Valute>/g;
  for (const match of xml.match(re) ?? []) {
    const code = /<CharCode>([^<]+)<\/CharCode>/.exec(match)?.[1]?.trim();
    const nominalRaw = /<Nominal>([^<]+)<\/Nominal>/.exec(match)?.[1]?.trim();
    const valueRaw = /<Value>([^<]+)<\/Value>/.exec(match)?.[1]?.trim();
    if (!code || !nominalRaw || !valueRaw) continue;
    const nominal = Number.parseInt(nominalRaw, 10);
    if (!Number.isFinite(nominal) || nominal <= 0) continue;
    try {
      const value = new Decimal(valueRaw.replace(',', '.'));
      rows.push({ code: code.toUpperCase(), nominal, value });
    } catch {
      // мусор — пропускаем
    }
  }
  return rows;
}

/// Парсит NBK XML формата
/// `<item><title>USD</title><description>92.50</description><quant>1</quant></item>`.
function parseNbkXml(xml: string): RateRow[] {
  const rows: RateRow[] = [];
  const re = /<item[^>]*>[\s\S]*?<\/item>/g;
  for (const match of xml.match(re) ?? []) {
    const title = /<title>([^<]+)<\/title>/.exec(match)?.[1]?.trim();
    const descr = /<description>([^<]+)<\/description>/.exec(match)?.[1]?.trim();
    const quantRaw = /<quant>([^<]+)<\/quant>/.exec(match)?.[1]?.trim();
    if (!title || !descr) continue;
    const code = title.toUpperCase().slice(0, 3);
    const nominal = quantRaw ? Number.parseInt(quantRaw, 10) : 1;
    try {
      const value = new Decimal(descr.replace(',', '.'));
      rows.push({
        code,
        nominal: Number.isFinite(nominal) && nominal > 0 ? nominal : 1,
        value,
      });
    } catch {
      // ignore
    }
  }
  return rows;
}

/// Парсит ECB XML формата
/// `<Cube currency="USD" rate="1.0850"/>`. У ECB nominal всегда 1.
function parseEcbXml(xml: string): RateRow[] {
  const rows: RateRow[] = [];
  const re = /<Cube\s+currency="([^"]+)"\s+rate="([^"]+)"\s*\/>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) != null) {
    const code = m[1].toUpperCase();
    try {
      const value = new Decimal(m[2]);
      rows.push({ code, nominal: 1, value });
    } catch {
      // ignore
    }
  }
  return rows;
}

/// Считает кросс-курс base→quote через базовую валюту источника
/// (`source` = RUB для CBR, KZT для NBK, EUR для ECB).
///
/// Если base = source, нам нужен 1 source = X quote → используем 1/(X→source).
/// Если quote = source, нам нужен 1 base = X source → прямое значение.
/// Иначе — кросс-курс: (base→source) / (quote→source).
function computeCrossRate(
  rates: RateRow[],
  base: string,
  quote: string,
  source: string,
): Decimal {
  const findRate = (currency: string): Decimal | null => {
    if (currency === source) return new Decimal(1);
    const row = rates.find((r) => r.code === currency);
    if (!row) return null;
    // value у CBR — «X RUB за nominal валюты». Нормализуем к 1 единице.
    return row.value.div(row.nominal);
  };
  const baseToSource = findRate(base);
  const quoteToSource = findRate(quote);
  if (!baseToSource) {
    throw new Error(
      `Источник курсов не содержит ${base} (источник базы: ${source}).`,
    );
  }
  if (!quoteToSource) {
    throw new Error(
      `Источник курсов не содержит ${quote} (источник базы: ${source}).`,
    );
  }
  // base→quote = (base→source) / (quote→source)
  return baseToSource.div(quoteToSource);
}

// Экспорт для unit-тестов.
export const __testables = {
  parseCbrXml,
  parseNbkXml,
  parseEcbXml,
  computeCrossRate,
};
