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
import { FinanceModule } from './finance/finance.module';
import { DebugController } from './debug/debug.controller';
import { HealthController } from './health/health.controller';
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
        // Лимит по умолчанию — 300 запросов в минуту (обычный трафик)
        name: 'default',
        ttl: 60_000,
        limit: 300,
      },
      {
        // Строгий лимит для login — 5 попыток в минуту с одного IP
        name: 'login',
        ttl: 60_000,
        limit: 5,
      },
    ]),
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
