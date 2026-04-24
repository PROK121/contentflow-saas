import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { GlobalExceptionFilter } from './common/http-exception.filter';
import { SerializeInterceptor } from './common/serialize.interceptor';
import { AppModule } from './app.module';

function assertEnv() {
  const required: string[] = ['DATABASE_URL', 'JWT_SECRET'];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(
      `[startup] Missing required environment variables: ${missing.join(', ')}`,
    );
  }

  const port = Number(process.env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`[startup] Invalid PORT value: "${process.env.PORT}"`);
  }

  const webOrigin = process.env.WEB_ORIGIN;
  if (webOrigin) {
    for (const origin of webOrigin.split(',').map((o) => o.trim())) {
      try {
        new URL(origin);
      } catch {
        throw new Error(
          `[startup] WEB_ORIGIN contains invalid URL: "${origin}"`,
        );
      }
    }
  }
}

async function bootstrap() {
  assertEnv();
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
