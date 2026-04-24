-- AlterTable
ALTER TABLE "CommercialOffer" ADD COLUMN "archived" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Contract" ADD COLUMN "archived" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN "archived" BOOLEAN NOT NULL DEFAULT false;
