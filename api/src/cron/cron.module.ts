import { Module } from '@nestjs/common';
import { EmailModule } from '../email/email.module';
import { PrismaModule } from '../prisma/prisma.module';
import { CronService } from './cron.service';

/// Cron-задачи: email-retry, истечение TaxProfile-сертификатов.
/// Запускается автоматически на старте инстанса. Управляется env:
///   DISABLE_CRON=1 — полностью выключить (нужно для CI и для второго
///   инстанса, чтобы cron не дублировался при горизонтальном масштабе).
@Module({
  imports: [PrismaModule, EmailModule],
  providers: [CronService],
})
export class CronModule {}
