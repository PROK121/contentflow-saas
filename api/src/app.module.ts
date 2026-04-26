import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
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
import { OrganizationsModule } from './organizations/organizations.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        // Лимит по умолчанию — 1200 запросов в минуту на один IP. Запас нужен,
        // потому что health-check Render и несколько менеджеров одновременно
        // суммарно дают много запросов. При превышении лимита возвращается 429,
        // и Render ошибочно помечает инстанс «нездоровым».
        name: 'default',
        ttl: 60_000,
        limit: 1200,
      },
      {
        // Строгий лимит для login — 10 попыток в минуту с одного IP
        name: 'login',
        ttl: 60_000,
        limit: 10,
      },
    ]),
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
  ],
})
export class AppModule {}
