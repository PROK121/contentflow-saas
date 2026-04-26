import { randomUUID } from 'crypto';
import * as fs from 'fs';
import { diskStorage } from 'multer';
import * as path from 'path';
import type { Request } from 'express';

export function materialsUploadRoot(): string {
  const root = process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'uploads');
  return path.join(root, 'materials');
}

/// Multer storage для материалов. Файл кладётся в
/// `${UPLOAD_DIR}/materials/{requestId}/{uuid}{ext}`.
/// Имя берётся из URL-параметра `:id` (request id).
export function materialDiskStorage() {
  return diskStorage({
    destination: (req: Request, _file, cb) => {
      const requestId = (req.params['id'] as string | undefined) || 'unknown';
      const dir = path.join(materialsUploadRoot(), requestId);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).slice(0, 20).toLowerCase();
      cb(null, `${randomUUID()}${ext}`);
    },
  });
}

/// Полный путь к файлу для скачивания / удаления.
export function materialAbsolutePath(requestId: string, storedFileName: string): string {
  return path.join(materialsUploadRoot(), requestId, storedFileName);
}

/// Безопасно удалить файл (без выброса, если файла нет).
export async function safeUnlinkMaterial(absPath: string): Promise<void> {
  try {
    await fs.promises.unlink(absPath);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw e;
    }
  }
}
