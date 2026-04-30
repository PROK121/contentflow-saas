-- Аудит CRM-стороны (действия менеджеров/админов) и учёт отправки писем.

-- CrmAuditLog ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "CrmAuditLog" (
  "id"             TEXT PRIMARY KEY,
  "userId"         TEXT NOT NULL,
  "action"         TEXT NOT NULL,
  "entityType"     TEXT,
  "entityId"       TEXT,
  "organizationId" TEXT,
  "ip"             TEXT,
  "userAgent"      TEXT,
  "metadata"       JSONB,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "CrmAuditLog_userId_createdAt_idx"
  ON "CrmAuditLog" ("userId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "CrmAuditLog_entityType_entityId_idx"
  ON "CrmAuditLog" ("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "CrmAuditLog_organizationId_createdAt_idx"
  ON "CrmAuditLog" ("organizationId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "CrmAuditLog_action_createdAt_idx"
  ON "CrmAuditLog" ("action", "createdAt" DESC);

-- EmailDelivery --------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE "EmailDeliveryStatus" AS ENUM ('pending','sent','failed','skipped');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "EmailDelivery" (
  "id"        TEXT PRIMARY KEY,
  "to"        TEXT NOT NULL,
  "category"  TEXT NOT NULL,
  "subject"   TEXT NOT NULL,
  "entityId"  TEXT,
  "status"    "EmailDeliveryStatus" NOT NULL DEFAULT 'pending',
  "attempts"  INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "sentAt"    TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "EmailDelivery_to_createdAt_idx"
  ON "EmailDelivery" ("to", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "EmailDelivery_category_status_idx"
  ON "EmailDelivery" ("category", "status");
CREATE INDEX IF NOT EXISTS "EmailDelivery_entityId_idx"
  ON "EmailDelivery" ("entityId");
