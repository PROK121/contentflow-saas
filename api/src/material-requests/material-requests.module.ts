import { Module } from '@nestjs/common';
import { HetznerStorageModule } from '../hetzner-storage/hetzner-storage.module';
import { PrismaModule } from '../prisma/prisma.module';
import { MaterialRequestsController } from './material-requests.controller';
import { MaterialRequestsService } from './material-requests.service';

@Module({
  imports: [PrismaModule, HetznerStorageModule],
  controllers: [MaterialRequestsController],
  providers: [MaterialRequestsService],
  exports: [MaterialRequestsService],
})
export class MaterialRequestsModule {}
