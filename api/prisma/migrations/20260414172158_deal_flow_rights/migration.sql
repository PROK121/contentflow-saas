-- CreateEnum
CREATE TYPE "DealActivityKind" AS ENUM ('comment', 'system', 'file');

-- AlterEnum
ALTER TYPE "ContractStatus" ADD VALUE 'sent';

-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE 'partially_paid';

-- AlterEnum
ALTER TYPE "Platform" ADD VALUE 'Web';

-- AlterTable
ALTER TABLE "Contract" ADD COLUMN     "dealSnapshotFingerprint" TEXT,
ADD COLUMN     "signingDueAt" TIMESTAMP(3),
ADD COLUMN     "templateId" TEXT;

-- AlterTable
ALTER TABLE "DealCatalogItem" ADD COLUMN     "rightsSelection" JSONB;

-- CreateTable
CREATE TABLE "DealActivity" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "kind" "DealActivityKind" NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DealActivity_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "DealActivity" ADD CONSTRAINT "DealActivity_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealActivity" ADD CONSTRAINT "DealActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
