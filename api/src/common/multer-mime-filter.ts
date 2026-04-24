import { BadRequestException } from '@nestjs/common';
import type { Request } from 'express';

/**
 * Allowed MIME types for deal/contract document uploads.
 * Extend the set if new document formats are required.
 */
const DOCUMENT_MIMES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

/** Allowed MIME types for catalog poster uploads. */
const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export function documentMimeFilter(
  _req: Request,
  file: Express.Multer.File,
  cb: (error: Error | null, acceptFile: boolean) => void,
) {
  if (DOCUMENT_MIMES.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new BadRequestException(
        `Недопустимый тип файла: ${file.mimetype}. Разрешены: PDF, Word, Excel, JPEG, PNG, WebP, GIF.`,
      ),
      false,
    );
  }
}

export function imageMimeFilter(
  _req: Request,
  file: Express.Multer.File,
  cb: (error: Error | null, acceptFile: boolean) => void,
) {
  if (IMAGE_MIMES.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new BadRequestException(
        `Недопустимый тип файла: ${file.mimetype}. Разрешены только изображения JPEG, PNG, WebP, GIF.`,
      ),
      false,
    );
  }
}
