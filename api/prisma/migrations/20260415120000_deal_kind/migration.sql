-- CreateEnum
CREATE TYPE "DealKind" AS ENUM ('sale', 'purchase');

-- AlterTable
ALTER TABLE "Deal" ADD COLUMN "kind" "DealKind" NOT NULL DEFAULT 'sale';
