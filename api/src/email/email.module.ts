import { Global, Module } from '@nestjs/common';
import { EmailService } from './email.service';

/// Глобальный модуль — `EmailService` доступен везде без импорта.
/// Это упрощает интеграцию: каждый сервис, отправляющий письмо,
/// просто инжектит `EmailService`.
@Global()
@Module({
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
