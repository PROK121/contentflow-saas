-- Подписанные офферы из кабинета клиента (метаданные; загрузка — позже)
ALTER TABLE "CommercialOffer" ADD COLUMN "clientSigned" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CommercialOffer" ADD COLUMN "signedAt" TIMESTAMP(3);
ALTER TABLE "CommercialOffer" ADD COLUMN "sourceOfferId" TEXT;
