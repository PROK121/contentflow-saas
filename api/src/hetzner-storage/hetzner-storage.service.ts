import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'stream';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const SftpClient = require('ssh2-sftp-client');

/**
 * Сервис для работы с Hetzner Storage Box через SFTP.
 * Хост:     u585689.your-storagebox.de
 * Пользователь: u585689
 * Порт:     23
 *
 * Переменные окружения:
 *   HETZNER_STORAGE_HOST     — хост (опц., по умолч. u585689.your-storagebox.de)
 *   HETZNER_STORAGE_USER     — пользователь (опц., по умолч. u585689)
 *   HETZNER_STORAGE_PASSWORD — пароль (обязательно)
 */
@Injectable()
export class HetznerStorageService implements OnModuleDestroy {
  private readonly logger = new Logger(HetznerStorageService.name);

  private readonly host: string;
  private readonly username: string;
  private readonly password: string;
  private readonly port = 23;

  constructor(private readonly config: ConfigService) {
    this.host =
      config.get<string>('HETZNER_STORAGE_HOST') ??
      'u585689.your-storagebox.de';
    this.username =
      config.get<string>('HETZNER_STORAGE_USER') ?? 'u585689';
    this.password = config.get<string>('HETZNER_STORAGE_PASSWORD') ?? '';
  }

  async onModuleDestroy() {
    // Ничего не держим открытым — соединения разовые
  }

  /** Создаёт и возвращает подключённый SFTP-клиент. Закрывать после использования. */
  private async connect(): Promise<any> {
    const sftp = new SftpClient();
    await sftp.connect({
      host: this.host,
      port: this.port,
      username: this.username,
      password: this.password,
      readyTimeout: 30_000,
    });
    return sftp;
  }

  /**
   * Загружает файл (Buffer или Readable) на Storage Box.
   * @param remotePath  Путь на сервере, напр. '/contentflow/catalog/abc123/poster.jpg'
   * @param data        Содержимое файла
   */
  async upload(remotePath: string, data: Buffer | Readable): Promise<void> {
    const sftp = await this.connect();
    try {
      // Создаём директорию если не существует
      const dir = remotePath.substring(0, remotePath.lastIndexOf('/'));
      if (dir) await sftp.mkdir(dir, true).catch(() => null);

      await sftp.put(data, remotePath);
      this.logger.log(`Uploaded: ${remotePath}`);
    } finally {
      await sftp.end();
    }
  }

  /**
   * Скачивает файл с Storage Box и возвращает Buffer.
   * @param remotePath  Путь на сервере, напр. '/contentflow/catalog/abc123/poster.jpg'
   */
  async download(remotePath: string): Promise<Buffer> {
    const sftp = await this.connect();
    try {
      const chunks: Buffer[] = [];
      await sftp.get(remotePath, (chunk: Buffer) => {
        chunks.push(chunk);
      });
      return Buffer.concat(chunks);
    } finally {
      await sftp.end();
    }
  }

  /**
   * Скачивает файл в виде Readable stream (для StreamableFile в NestJS).
   */
  async downloadStream(remotePath: string): Promise<Readable> {
    const sftp = await this.connect();
    try {
      const stream = await sftp.createReadStream(remotePath);
      // Закрываем соединение когда поток завершён
      stream.on('close', () => sftp.end().catch(() => null));
      stream.on('error', () => sftp.end().catch(() => null));
      return stream;
    } catch (err) {
      await sftp.end();
      throw err;
    }
  }

  /**
   * Удаляет файл с Storage Box.
   */
  async delete(remotePath: string): Promise<void> {
    const sftp = await this.connect();
    try {
      await sftp.delete(remotePath);
      this.logger.log(`Deleted: ${remotePath}`);
    } finally {
      await sftp.end();
    }
  }

  /**
   * Проверяет существование файла.
   */
  async exists(remotePath: string): Promise<boolean> {
    const sftp = await this.connect();
    try {
      const stat = await sftp.stat(remotePath).catch(() => null);
      return stat !== null;
    } finally {
      await sftp.end();
    }
  }

  /**
   * Список файлов в директории.
   */
  async list(remoteDir: string): Promise<string[]> {
    const sftp = await this.connect();
    try {
      await sftp.mkdir(remoteDir, true).catch(() => null);
      const entries = await sftp.list(remoteDir);
      return entries.map((e: any) => e.name as string);
    } finally {
      await sftp.end();
    }
  }

  /**
   * Синхронизирует локальную директорию на Storage Box.
   * Используется для бэкапа uploads/ с Render на Hetzner.
   * @param localDir   Локальный путь, напр. '/app/uploads'
   * @param remoteDir  Путь на сервере, напр. '/contentflow/uploads'
   */
  async syncLocalToRemote(localDir: string, remoteDir: string): Promise<void> {
    const { readdir, stat, readFile } = await import('fs/promises');
    const path = await import('path');

    const sftp = await this.connect();
    try {
      await sftp.mkdir(remoteDir, true).catch(() => null);
      await this.syncDir(sftp, localDir, remoteDir, readdir, stat, readFile, path);
      this.logger.log(`Sync complete: ${localDir} → ${remoteDir}`);
    } finally {
      await sftp.end();
    }
  }

  private async syncDir(
    sftp: any,
    localDir: string,
    remoteDir: string,
    readdir: any,
    stat: any,
    readFile: any,
    path: any,
  ): Promise<void> {
    const entries = await readdir(localDir).catch(() => []);
    for (const entry of entries) {
      const localPath = path.join(localDir, entry);
      const remotePath = `${remoteDir}/${entry}`;
      const s = await stat(localPath);
      if (s.isDirectory()) {
        await sftp.mkdir(remotePath, true).catch(() => null);
        await this.syncDir(sftp, localPath, remotePath, readdir, stat, readFile, path);
      } else {
        const data = await readFile(localPath);
        await sftp.put(data, remotePath);
      }
    }
  }
}
