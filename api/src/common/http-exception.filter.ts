import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';

function getErrorMessage(exception: unknown): string {
  if (exception instanceof Prisma.PrismaClientKnownRequestError) {
    return `[Prisma ${exception.code}] ${exception.message}`;
  }
  if (exception instanceof Prisma.PrismaClientInitializationError) {
    return `[Prisma] База недоступна: ${exception.message}. Проверьте DATABASE_URL и что Postgres запущен (docker compose up -d).`;
  }
  if (exception instanceof Prisma.PrismaClientUnknownRequestError) {
    return `[Prisma] ${exception.message}`;
  }
  if (exception instanceof Prisma.PrismaClientRustPanicError) {
    return `[Prisma engine] ${exception.message}`;
  }
  if (exception instanceof Error) {
    return exception.message;
  }
  if (typeof exception === 'string') {
    return exception;
  }
  try {
    return JSON.stringify(exception);
  } catch {
    return 'Unknown error';
  }
}

/**
 * JSON с полем message для любых ошибок; Prisma — с кодом и понятным текстом.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
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

    const message = getErrorMessage(exception);

    console.error(
      '[API]',
      request.method,
      request.url,
      exception instanceof Error ? exception.stack : exception,
    );

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message,
      path: request.url,
      error: 'Internal Server Error',
    });
  }
}
