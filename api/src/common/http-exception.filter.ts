import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import type { Request, Response } from 'express';

const isProduction = process.env.NODE_ENV === 'production';

/// «Безопасное» сообщение для клиента: имена таблиц/колонок/значений Prisma
/// могут раскрыть структуру схемы и потенциально ПДн, поэтому в проде
/// клиенту отдаём только обобщённое описание + traceId. Полный текст ошибки
/// и stack пишем в логи, по traceId служба поддержки находит детали.
function getClientMessage(exception: unknown): string {
  if (exception instanceof Prisma.PrismaClientInitializationError) {
    return isProduction
      ? 'База данных временно недоступна'
      : `[Prisma] База недоступна: ${exception.message}. Проверьте DATABASE_URL и что Postgres запущен (docker compose up -d).`;
  }
  if (exception instanceof Prisma.PrismaClientKnownRequestError) {
    if (isProduction) {
      // Известные коды можно частично раскрыть — без имён таблиц.
      switch (exception.code) {
        case 'P2002':
          return 'Запись с такими уникальными значениями уже существует';
        case 'P2025':
          return 'Запрашиваемая запись не найдена';
        case 'P2003':
          return 'Связанная запись не существует или уже удалена';
        default:
          return 'Ошибка обработки запроса';
      }
    }
    return `[Prisma ${exception.code}] ${exception.message}`;
  }
  if (
    exception instanceof Prisma.PrismaClientUnknownRequestError ||
    exception instanceof Prisma.PrismaClientRustPanicError
  ) {
    return isProduction ? 'Внутренняя ошибка БД' : (exception as Error).message;
  }
  if (exception instanceof Error) {
    return isProduction ? 'Внутренняя ошибка сервера' : exception.message;
  }
  if (typeof exception === 'string') {
    return isProduction ? 'Внутренняя ошибка сервера' : exception;
  }
  return 'Internal Server Error';
}

/// Полный текст для логов — никогда не попадает к клиенту.
function getFullMessage(exception: unknown): string {
  if (exception instanceof Error) return exception.message;
  if (typeof exception === 'string') return exception;
  try {
    return JSON.stringify(exception);
  } catch {
    return 'Unknown error';
  }
}

/**
 * JSON с полем message для любых ошибок. В проде Prisma-детали маскируются;
 * traceId генерируется на каждый 500 и пишется в лог + ответ клиенту, чтобы
 * саппорт мог сопоставить жалобу с записью в логах.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      response
        .status(status)
        .json(
          typeof body === 'object' && body !== null
            ? body
            : { statusCode: status, message: body },
        );
      return;
    }

    const traceId = randomUUID();
    const fullMsg = getFullMessage(exception);
    const clientMsg = getClientMessage(exception);

    // В лог: метод, путь, traceId, полное сообщение и stack.
    this.logger.error(
      `[${traceId}] ${request.method} ${request.url} :: ${fullMsg}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: clientMsg,
      traceId,
      path: request.url,
      error: 'Internal Server Error',
    });
  }
}
