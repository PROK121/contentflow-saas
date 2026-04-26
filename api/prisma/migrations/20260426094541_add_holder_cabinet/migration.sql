-- ContentFlow: добавление кабинета правообладателя.
-- Идемпотентно: повторный запуск не упадёт, если объекты уже существуют
-- (используем IF NOT EXISTS / DO blocks).

-- ============================================================================
-- 1. Расширение модели User: invite, согласие на условия, последний вход
-- ============================================================================
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "metadata"         JSONB;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "invitedAt"        TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "invitedByUserId"  TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "acceptedTermsAt"  TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "acceptedTermsVer" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastLoginAt"      TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastLoginIp"      TEXT;

CREATE INDEX IF NOT EXISTS "User_organizationId_idx" ON "User"("organizationId");
CREATE INDEX IF NOT EXISTS "User_role_idx"           ON "User"("role");

-- ============================================================================
-- 2. HolderInvite — токены приглашений в кабинет правообладателя
-- ============================================================================
CREATE TABLE IF NOT EXISTS "HolderInvite" (
  "id"               TEXT PRIMARY KEY,
  "organizationId"   TEXT NOT NULL,
  "email"            TEXT NOT NULL,
  "tokenHash"        TEXT NOT NULL,
  "invitedByUserId"  TEXT NOT NULL,
  "expiresAt"        TIMESTAMP(3) NOT NULL,
  "consumedAt"       TIMESTAMP(3),
  "consumedByUserId" TEXT,
  "note"             TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "HolderInvite_tokenHash_key"        ON "HolderInvite"("tokenHash");
CREATE INDEX        IF NOT EXISTS "HolderInvite_organizationId_idx"   ON "HolderInvite"("organizationId");
CREATE INDEX        IF NOT EXISTS "HolderInvite_email_idx"            ON "HolderInvite"("email");
CREATE INDEX        IF NOT EXISTS "HolderInvite_expiresAt_idx"        ON "HolderInvite"("expiresAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'HolderInvite_organizationId_fkey'
  ) THEN
    ALTER TABLE "HolderInvite"
      ADD CONSTRAINT "HolderInvite_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'HolderInvite_invitedByUserId_fkey'
  ) THEN
    ALTER TABLE "HolderInvite"
      ADD CONSTRAINT "HolderInvite_invitedByUserId_fkey"
      FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT;
  END IF;
END$$;

-- ============================================================================
-- 3. HolderAuditLog — журнал критичных действий правообладателя
-- ============================================================================
CREATE TABLE IF NOT EXISTS "HolderAuditLog" (
  "id"             TEXT PRIMARY KEY,
  "userId"         TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "action"         TEXT NOT NULL,
  "entityType"     TEXT,
  "entityId"       TEXT,
  "ip"             TEXT,
  "userAgent"      TEXT,
  "metadata"       JSONB,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "HolderAuditLog_orgId_createdAt_idx"  ON "HolderAuditLog"("organizationId", "createdAt");
CREATE INDEX IF NOT EXISTS "HolderAuditLog_userId_createdAt_idx" ON "HolderAuditLog"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "HolderAuditLog_action_createdAt_idx" ON "HolderAuditLog"("action", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'HolderAuditLog_userId_fkey'
  ) THEN
    ALTER TABLE "HolderAuditLog"
      ADD CONSTRAINT "HolderAuditLog_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT;
  END IF;
END$$;

-- ============================================================================
-- 4. Enums для запросов на материалы
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MaterialRequestStatus') THEN
    CREATE TYPE "MaterialRequestStatus" AS ENUM ('pending','partial','complete','rejected','cancelled');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MaterialReviewStatus') THEN
    CREATE TYPE "MaterialReviewStatus" AS ENUM ('pending','approved','rejected');
  END IF;
END$$;

-- ============================================================================
-- 5. MaterialRequest — запрос материалов от менеджера к правообладателю
-- ============================================================================
CREATE TABLE IF NOT EXISTS "MaterialRequest" (
  "id"              TEXT PRIMARY KEY,
  "catalogItemId"   TEXT NOT NULL,
  "organizationId"  TEXT NOT NULL,
  "requestedSlots"  TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "status"          "MaterialRequestStatus" NOT NULL DEFAULT 'pending',
  "dueAt"           TIMESTAMP(3),
  "note"            TEXT,
  "createdByUserId" TEXT NOT NULL,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "MaterialRequest_catalogItemId_idx" ON "MaterialRequest"("catalogItemId");
CREATE INDEX IF NOT EXISTS "MaterialRequest_orgId_status_idx"  ON "MaterialRequest"("organizationId", "status");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MaterialRequest_catalogItemId_fkey'
  ) THEN
    ALTER TABLE "MaterialRequest"
      ADD CONSTRAINT "MaterialRequest_catalogItemId_fkey"
      FOREIGN KEY ("catalogItemId") REFERENCES "CatalogItem"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MaterialRequest_organizationId_fkey'
  ) THEN
    ALTER TABLE "MaterialRequest"
      ADD CONSTRAINT "MaterialRequest_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE;
  END IF;
END$$;

-- ============================================================================
-- 6. MaterialUpload — загруженные файлы по запросу
-- ============================================================================
CREATE TABLE IF NOT EXISTS "MaterialUpload" (
  "id"               TEXT PRIMARY KEY,
  "requestId"        TEXT NOT NULL,
  "slot"             TEXT NOT NULL,
  "storedFileName"   VARCHAR(512) NOT NULL,
  "originalName"     VARCHAR(512) NOT NULL,
  "size"             BIGINT NOT NULL,
  "mimeType"         TEXT,
  "reviewStatus"     "MaterialReviewStatus" NOT NULL DEFAULT 'pending',
  "reviewerComment"  TEXT,
  "reviewedByUserId" TEXT,
  "reviewedAt"       TIMESTAMP(3),
  "uploadedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "MaterialUpload_requestId_idx"    ON "MaterialUpload"("requestId");
CREATE INDEX IF NOT EXISTS "MaterialUpload_slot_idx"         ON "MaterialUpload"("slot");
CREATE INDEX IF NOT EXISTS "MaterialUpload_reviewStatus_idx" ON "MaterialUpload"("reviewStatus");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MaterialUpload_requestId_fkey'
  ) THEN
    ALTER TABLE "MaterialUpload"
      ADD CONSTRAINT "MaterialUpload_requestId_fkey"
      FOREIGN KEY ("requestId") REFERENCES "MaterialRequest"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MaterialUpload_reviewedByUserId_fkey'
  ) THEN
    ALTER TABLE "MaterialUpload"
      ADD CONSTRAINT "MaterialUpload_reviewedByUserId_fkey"
      FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL;
  END IF;
END$$;
