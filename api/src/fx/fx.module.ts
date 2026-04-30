import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { FxService } from './fx.service';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [FxService],
  exports: [FxService],
})
export class FxModule {}
