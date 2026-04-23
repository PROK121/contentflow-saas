-- Подписанные контракты из кабинета клиента (метаданные; загрузка — позже)
ALTER TABLE "Contract" ADD COLUMN "clientCabinetSigned" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Contract" ADD COLUMN "cabinetSignedAt" TIMESTAMP(3);
ALTER TABLE "Contract" ADD COLUMN "sourceContractId" TEXT;
