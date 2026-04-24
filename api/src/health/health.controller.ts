import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  ServiceUnavailableException,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from '../prisma/prisma.service';

@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Liveness-проба. Render дергает её часто (раз в несколько секунд),
   * поэтому здесь НЕ ходим в БД — иначе кратковременный лаг Postgres
   * превращается в перезапуск всего инстанса (и потенциальный OOM-цикл).
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  liveness() {
    return { status: 'ok', service: 'contentflow-api' };
  }

  /**
   * Readiness-проба. Её можно вызывать отдельно (реже), чтобы проверить БД.
   */
  @Get('db')
  @HttpCode(HttpStatus.OK)
  async readiness() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        service: 'contentflow-api',
        db: 'unreachable',
      });
    }
    return { status: 'ok', service: 'contentflow-api', db: 'ok' };
  }
}
