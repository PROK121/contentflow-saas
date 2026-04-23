import {
  CallHandler,
  ExecutionContext,
  Injectable,
  InternalServerErrorException,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { serializeForJson } from './serialize-for-json';

@Injectable()
export class SerializeInterceptor implements NestInterceptor {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    return next.handle().pipe(
      map((data) => {
        try {
          if (data instanceof StreamableFile) return data;
          return serializeForJson(data);
        } catch (e) {
          const msg =
            e instanceof Error
              ? e.message
              : `Сериализация ответа: ${String(e)}`;
          throw new InternalServerErrorException(msg);
        }
      }),
    );
  }
}
