-- Поля удержания и net по строке платежа (расчёт при создании)
ALTER TABLE "Payment" ADD COLUMN "withholdingTaxAmount" DECIMAL(18,2);
ALTER TABLE "Payment" ADD COLUMN "netAmount" DECIMAL(18,2);
