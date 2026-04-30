import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './auth/roles.guard';
import { FxModule } from './fx/fx.module';
import { TaxModule } from './tax/tax.module';
import { CatalogModule } from './catalog/catalog.module';
import { CommercialOffersModule } from './commercial-offers/commercial-offers.module';
import { ContractsModule } from './contracts/contracts.module';
import { DealsModule } from './deals/deals.module';
import { EmailModule } from './email/email.module';
import { FinanceModule } from './finance/finance.module';
import { DebugController } from './debug/debug.controller';
import { HealthController } from './health/health.controller';
import { HolderAuthModule } from './holder-auth/holder-auth.module';
import { HolderPortalModule } from './holder-portal/holder-portal.module';
import { MaterialRequestsModule } from './material-requests/material-requests.module';
import { PortalModule } from './portal/portal.module';
import { PrismaModule } from './prisma/prisma.module';
import { TasksModule } from './tasks/tasks.module';
import { HetznerStorageModule } from './hetzner-storage/hetzner-storage.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        // Лимит по умолчанию — 600 запросов в минуту на IP. Этого хватает
        // менеджеру с активной работой (поиск, открытие нескольких сделок),
        // но защищает от наивного DDoS. Health-check помечен `@SkipThrottle`,
        // отдельный лимит для login (см. ниже).
        name: 'default',
        ttl: 60_000,
        limit: 600,
      },
      {
        // Строгий лимит для login — 10 попыток в минуту с одного IP.
        name: 'login',
        ttl: 60_000,
        limit: 10,
      },
      {
        // Тяжёлые операции: генерация PDF контракта/оффера, экспорт каталога,
        // скачивание мастеров — 30/мин. Используется через `@Throttle({ heavy: ... })`.
        name: 'heavy',
        ttl: 60_000,
        limit: 30,
      },
    ]),
    AuditModule,
    FxModule,
    TaxModule,
    EmailModule,
    AuthModule,
    PrismaModule,
    OrganizationsModule,
    UsersModule,
    DealsModule,
    CatalogModule,
    ContractsModule,
    CommercialOffersModule,
    FinanceModule,
    TasksModule,
    PortalModule,
    HolderAuthModule,
    MaterialRequestsModule,
    HolderPortalModule,
    HetznerStorageModule,
  ],
  controllers: [HealthController, DebugController],
  providers: [
    {
      // ThrottlerGuard идёт первым — ограничивает rate до проверки JWT
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      // RolesGuard идёт после JwtAuthGuard — на этом этапе мы уже знаем
      // `req.user`. Гард default-deny: без явного `@Roles(...)` отказ.
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
