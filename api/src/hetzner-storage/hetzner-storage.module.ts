import { Module } from '@nestjs/common';
import { HetznerStorageService } from './hetzner-storage.service';
import { HetznerStorageController } from './hetzner-storage.controller';

@Module({
  controllers: [HetznerStorageController],
  providers: [HetznerStorageService],
  exports: [HetznerStorageService],
})
export class HetznerStorageModule {}
