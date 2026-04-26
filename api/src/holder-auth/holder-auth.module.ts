import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module';
import { HolderAuthController } from './holder-auth.controller';
import { HolderAuthService } from './holder-auth.service';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    // Свой JwtModule с теми же настройками — нужен для подписи и
    // верификации magic-link/JWT в этом модуле.
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET');
        if (!secret || secret.length < 16) {
          throw new Error('JWT_SECRET is not set or too short');
        }
        return {
          secret,
          signOptions: { expiresIn: '7d' },
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [HolderAuthController],
  providers: [HolderAuthService],
  exports: [HolderAuthService],
})
export class HolderAuthModule {}
