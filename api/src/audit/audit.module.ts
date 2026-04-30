import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CrmAuditService } from './crm-audit.service';

/// Глобальный модуль аудита CRM. `@Global()` — чтобы любой сервис мог
/// инжектить `CrmAuditService` без перечисления в imports каждого модуля.
@Global()
@Module({
  imports: [PrismaModule],
  providers: [CrmAuditService],
  exports: [CrmAuditService],
})
export class AuditModule {}
