-- Iteration 3: click-sign правообладателя и флаг видимости финансов.
-- Миграция идемпотентна — все ALTER/CREATE через IF NOT EXISTS / DO-блоки.

-- 1. Enum HolderFinanceVisibility (limited|full).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'HolderFinanceVisibility'
  ) THEN
    CREATE TYPE "HolderFinanceVisibility" AS ENUM ('limited', 'full');
  END IF;
END$$;

-- 2. Поле holderFinanceVisibility на Organization (default=limited).
ALTER TABLE "Organization"
  ADD COLUMN IF NOT EXISTS "holderFinanceVisibility" "HolderFinanceVisibility"
  NOT NULL DEFAULT 'limited';

-- 3. Поля click-sign на Contract.
ALTER TABLE "Contract"
  ADD COLUMN IF NOT EXISTS "holderSignedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "holderSignedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "holderSignedIp" TEXT,
  ADD COLUMN IF NOT EXISTS "holderSignedUserAgent" TEXT,
  ADD COLUMN IF NOT EXISTS "holderSignedVersion" INTEGER,
  ADD COLUMN IF NOT EXISTS "holderSignedHash" TEXT,
  ADD COLUMN IF NOT EXISTS "holderSignedTermsVer" TEXT;
