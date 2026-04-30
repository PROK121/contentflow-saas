import { Module } from '@nestjs/common';
import { DealsController } from './deals.controller';
import { DealsService } from './deals.service';
import { DriveModule } from '../drive/drive.module';
import { HetznerStorageModule } from '../hetzner-storage/hetzner-storage.module';

@Module({
  imports: [DriveModule, HetznerStorageModule],
  controllers: [DealsController],
  providers: [DealsService],
})
export class DealsModule {}
