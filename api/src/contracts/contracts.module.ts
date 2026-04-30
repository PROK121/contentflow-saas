import { Module } from '@nestjs/common';
import { HetznerStorageModule } from '../hetzner-storage/hetzner-storage.module';
import { ContractsController } from './contracts.controller';
import { ContractsService } from './contracts.service';

@Module({
  imports: [HetznerStorageModule],
  controllers: [ContractsController],
  providers: [ContractsService],
  exports: [ContractsService],
})
export class ContractsModule {}
