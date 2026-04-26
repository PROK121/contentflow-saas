import { Module } from '@nestjs/common';
import { ContractsModule } from '../contracts/contracts.module';
import { MaterialRequestsModule } from '../material-requests/material-requests.module';
import { PrismaModule } from '../prisma/prisma.module';
import { HolderAuditService } from './holder-audit.service';
import { HolderController } from './holder.controller';
import { HolderGuard } from './holder.guard';
import { HolderScopeService } from './holder-scope.service';

@Module({
  imports: [PrismaModule, ContractsModule, MaterialRequestsModule],
  controllers: [HolderController],
  providers: [HolderScopeService, HolderAuditService, HolderGuard],
  exports: [HolderScopeService, HolderAuditService, HolderGuard],
})
export class HolderPortalModule {}
