import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Диагностика без Prisma и с проверкой БД — помогает отличить «API не тот» от «БД мёртва».
 */
@Controller('debug')
export class DebugController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('ping')
  ping() {
    return {
      ok: true,
      service: 'contentflow-api',
      hint: 'Если вы видите это из браузера по :3000/v1/debug/ping — это Nest, не Next.',
    };
  }

  @Get('db')
  async db() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { ok: true, database: 'reachable' };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return {
        ok: false,
        database: 'unreachable',
        message,
        hint: 'Проверьте DATABASE_URL, docker compose up -d, prisma migrate deploy.',
      };
    }
  }
}
