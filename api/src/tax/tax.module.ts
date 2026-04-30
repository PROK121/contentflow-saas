import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TaxEngineService } from './tax-engine.service';

/// Глобальный модуль налогового движка. `@Global()` — чтобы любой сервис
/// (например, `PayoutsService`) мог инжектить `TaxEngineService` без
/// перечисления в imports.
@Global()
@Module({
  imports: [PrismaModule],
  providers: [TaxEngineService],
  exports: [TaxEngineService],
})
export class TaxModule {}
