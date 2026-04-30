-- TaxRule и FxRateCache.
-- Идемпотентная миграция (IF NOT EXISTS / DO blocks).

DO $$ BEGIN
  CREATE TYPE "WithholdingIncomeType" AS ENUM ('royalty','service','dividend');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "TaxRule" (
  "id"                       TEXT PRIMARY KEY,
  "payerCountry"             TEXT NOT NULL,
  "recipientCountry"         TEXT NOT NULL,
  "incomeType"               "WithholdingIncomeType" NOT NULL,
  "defaultRateWithoutTreaty" DECIMAL(9,4) NOT NULL,
  "treatyRateIfApplicable"   DECIMAL(9,4),
  "requiresDtCertificate"    BOOLEAN NOT NULL DEFAULT true,
  "note"                     TEXT,
  "version"                  INTEGER NOT NULL DEFAULT 1,
  "effectiveFrom"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "effectiveTo"              TIMESTAMP(3),
  "createdAt"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "TaxRule_lookup_idx"
  ON "TaxRule" ("payerCountry","recipientCountry","incomeType");
CREATE INDEX IF NOT EXISTS "TaxRule_effective_idx"
  ON "TaxRule" ("effectiveFrom","effectiveTo");

-- FxRateCache ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "FxRateCache" (
  "id"            TEXT PRIMARY KEY,
  "baseCurrency"  VARCHAR(3) NOT NULL,
  "quoteCurrency" VARCHAR(3) NOT NULL,
  "rate"          DECIMAL(18,8) NOT NULL,
  "source"        TEXT NOT NULL,
  "fetchedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "FxRateCache_uniq"
  ON "FxRateCache" ("baseCurrency","quoteCurrency","source","fetchedAt");
CREATE INDEX IF NOT EXISTS "FxRateCache_pair_source_idx"
  ON "FxRateCache" ("baseCurrency","quoteCurrency","source");

-- Дефолтный fallback-набор правил (комментарии — рекомендации юристу,
-- а не юр-консультация; ставки уточнить и подтвердить).
INSERT INTO "TaxRule" ("id","payerCountry","recipientCountry","incomeType","defaultRateWithoutTreaty","treatyRateIfApplicable","requiresDtCertificate","note","version")
VALUES
  (gen_random_uuid()::text, 'KZ','*','royalty', 15.0, 10.0, true, 'Базовая ставка КЗ для роялти нерезидентам — уточните по ст. 645 НК РК', 1),
  (gen_random_uuid()::text, 'RU','*','royalty', 20.0, 10.0, true, 'Базовая ставка РФ для роялти нерезидентам — уточните по гл. 25 НК РФ', 1),
  (gen_random_uuid()::text, '*','*','royalty', 20.0, NULL, false, 'Глобальный fallback — применяется, если нет точного правила', 1)
ON CONFLICT DO NOTHING;
