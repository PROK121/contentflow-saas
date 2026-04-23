-- CreateEnum
CREATE TYPE "OrganizationType" AS ENUM ('client', 'rights_holder', 'internal');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'manager', 'rights_owner', 'client');

-- CreateEnum
CREATE TYPE "DealStage" AS ENUM ('lead', 'negotiation', 'contract', 'paid');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('video', 'music', 'photo', 'series');

-- CreateEnum
CREATE TYPE "CatalogItemStatus" AS ENUM ('draft', 'active', 'archived');

-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('TV', 'OTT', 'YouTube');

-- CreateEnum
CREATE TYPE "Exclusivity" AS ENUM ('exclusive', 'non_exclusive', 'sole');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('draft', 'signed', 'expired');

-- CreateEnum
CREATE TYPE "PaymentDirection" AS ENUM ('inbound', 'outbound');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'paid', 'overdue', 'cancelled');

-- CreateEnum
CREATE TYPE "RoyaltyModel" AS ENUM ('fixed', 'percent');

-- CreateEnum
CREATE TYPE "RoyaltyBase" AS ENUM ('gross', 'net', 'collections');

-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('contract_expiry', 'payment_due', 'renewal', 'custom');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "taxId" TEXT,
    "isResident" BOOLEAN NOT NULL DEFAULT false,
    "type" "OrganizationType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'ru',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogItem" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "assetType" "AssetType" NOT NULL,
    "rightsHolderOrgId" TEXT NOT NULL,
    "metadata" JSONB,
    "status" "CatalogItemStatus" NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LicenseTerm" (
    "id" TEXT NOT NULL,
    "catalogItemId" TEXT NOT NULL,
    "territoryCode" TEXT NOT NULL,
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "durationMonths" INTEGER,
    "exclusivity" "Exclusivity" NOT NULL,
    "platforms" "Platform"[],
    "sublicensingAllowed" BOOLEAN NOT NULL DEFAULT false,
    "languageRights" TEXT[],

    CONSTRAINT "LicenseTerm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deal" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "stage" "DealStage" NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "buyerOrgId" TEXT NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "expectedCloseAt" TIMESTAMP(3),
    "actualCloseAt" TIMESTAMP(3),
    "commercialSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealCatalogItem" (
    "dealId" TEXT NOT NULL,
    "catalogItemId" TEXT NOT NULL,

    CONSTRAINT "DealCatalogItem_pkey" PRIMARY KEY ("dealId","catalogItemId")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" "ContractStatus" NOT NULL,
    "territory" TEXT NOT NULL,
    "termEndAt" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "fxRateFixed" DECIMAL(18,8),
    "fxRateSource" TEXT,
    "fxLockedAt" TIMESTAMP(3),
    "rightsPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractVersion" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signedAt" TIMESTAMP(3),

    CONSTRAINT "ContractVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "contractId" TEXT,
    "dealId" TEXT,
    "direction" "PaymentDirection" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "dueAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "status" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoyaltyLine" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "rightsHolderOrgId" TEXT NOT NULL,
    "model" "RoyaltyModel" NOT NULL,
    "percent" DECIMAL(9,4),
    "fixedAmount" DECIMAL(18,2),
    "base" "RoyaltyBase" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoyaltyLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxProfile" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "isTaxResidentInPayerCountry" BOOLEAN NOT NULL DEFAULT false,
    "dtCertificatePresent" BOOLEAN NOT NULL DEFAULT false,
    "withholdingRateOverride" DECIMAL(9,4),
    "residencyCertificateKey" TEXT,
    "validUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payout" (
    "id" TEXT NOT NULL,
    "royaltyLineId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "rightsHolderOrgId" TEXT NOT NULL,
    "amountGross" DECIMAL(18,2) NOT NULL,
    "withholdingTaxAmount" DECIMAL(18,2) NOT NULL,
    "amountNet" DECIMAL(18,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "taxProfileSnapshotId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "assigneeId" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "type" "TaskType" NOT NULL,
    "linkedEntityType" TEXT NOT NULL,
    "linkedEntityId" TEXT NOT NULL,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogItem_slug_key" ON "CatalogItem"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ContractVersion_contractId_version_key" ON "ContractVersion"("contractId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "TaxProfile_organizationId_jurisdiction_key" ON "TaxProfile"("organizationId", "jurisdiction");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogItem" ADD CONSTRAINT "CatalogItem_rightsHolderOrgId_fkey" FOREIGN KEY ("rightsHolderOrgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LicenseTerm" ADD CONSTRAINT "LicenseTerm_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "CatalogItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_buyerOrgId_fkey" FOREIGN KEY ("buyerOrgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealCatalogItem" ADD CONSTRAINT "DealCatalogItem_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealCatalogItem" ADD CONSTRAINT "DealCatalogItem_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "CatalogItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractVersion" ADD CONSTRAINT "ContractVersion_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoyaltyLine" ADD CONSTRAINT "RoyaltyLine_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoyaltyLine" ADD CONSTRAINT "RoyaltyLine_rightsHolderOrgId_fkey" FOREIGN KEY ("rightsHolderOrgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxProfile" ADD CONSTRAINT "TaxProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_royaltyLineId_fkey" FOREIGN KEY ("royaltyLineId") REFERENCES "RoyaltyLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_rightsHolderOrgId_fkey" FOREIGN KEY ("rightsHolderOrgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

