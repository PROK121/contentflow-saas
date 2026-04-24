import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { GlobalExceptionFilter } from './common/http-exception.filter';
import { SerializeInterceptor } from './common/serialize.interceptor';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  /**
   * На Render / любом reverse-proxy запросы приходят через load balancer.
   * Без `trust proxy` Express считает источником один и тот же внутренний IP,
   * и ThrottlerGuard ограничивает всех пользователей скопом (429 на health-check).
   * С включённым trust proxy req.ip = реальный клиент (X-Forwarded-For).
   */
  app.set('trust proxy', 1);
  app.use(cookieParser());
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new SerializeInterceptor());
  const webOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:3020';
  app.enableCors({
    origin: webOrigin.split(',').map((o) => o.trim()),
    credentials: true,
  });
  app.setGlobalPrefix('v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
