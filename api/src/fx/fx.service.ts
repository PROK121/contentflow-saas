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

  /// ЦБ РФ публикует XML на https://www.cbr.ru/scripts/XML_daily.asp
  /// Реализация — задача отдельного PR (нужны DOMParser + cron на 11:30 МСК
  /// для актуального курса). Сейчас заглушка.
  private async fetchCbr(base: string, quote: string): Promise<Decimal> {
    throw new Error(
      `Адаптер CBR не реализован для ${base}/${quote}. Заполните FxRateCache вручную или подключите парсер cbr.ru/scripts/XML_daily.asp.`,
    );
  }

  private async fetchNbk(base: string, quote: string): Promise<Decimal> {
    throw new Error(
      `Адаптер NBK не реализован для ${base}/${quote}. Источник: nationalbank.kz (XML).`,
    );
  }

  private async fetchEcb(base: string, quote: string): Promise<Decimal> {
    throw new Error(
      `Адаптер ECB не реализован для ${base}/${quote}. Источник: ecb.europa.eu/stats/eurofxref.`,
    );
  }
}
