import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET');
        if (!secret || secret.length < 16) {
          throw new Error(
            'JWT_SECRET is not set or is shorter than 16 chars. Set a strong secret in the environment (see api/.env.example).',
          );
        }
        // TTL access-токена 12ч — компромисс между UX (не разлогинивает
        // менеджера в середине рабочего дня) и безопасностью (утёкший токен
        // живёт ограниченное время). При вводе refresh-токена сократить до
        // 30–60 минут.
        // На сегодня единственная защита от долгоживущего утёкшего токена —
        // `User.tokenVersion`: смена пароля / logout-all инвалидируют все
        // ранее выпущенные JWT. См. AuthService.bumpTokenVersion.
        return {
          secret,
          signOptions: { expiresIn: '12h' },
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtAuthGuard],
  exports: [AuthService, JwtAuthGuard],
})
export class AuthModule {}
