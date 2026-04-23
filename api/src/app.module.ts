import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
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
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
