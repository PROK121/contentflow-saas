-- AlterTable
ALTER TABLE "Deal" ADD COLUMN IF NOT EXISTS "dealDocuments" JSONB;
