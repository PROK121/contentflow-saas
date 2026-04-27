import { execFile } from 'child_process';
import { existsSync } from 'fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import * as path from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

function resolveSofficePath(): string {
  const fromEnv = process.env.LIBREOFFICE_PATH?.trim();
  if (fromEnv && existsSync(fromEnv)) return fromEnv;

  const mac = '/Applications/LibreOffice.app/Contents/MacOS/soffice';
  if (existsSync(mac)) return mac;

  const macAlt = '/Applications/LibreOffice.app/Contents/MacOS/LibreOffice';
  if (existsSync(macAlt)) return macAlt;

  return process.platform === 'win32' ? 'soffice.exe' : 'soffice';
}

/**
 * DOCX → PDF через LibreOffice (soffice --headless). Требуется установленный LibreOffice.
 */
export async function convertDocxBufferToPdf(
  docxBuffer: Buffer,
): Promise<Buffer> {
  const soffice = resolveSofficePath();
  const dir = await mkdtemp(path.join(tmpdir(), 'cf-offer-'));
  const docxPath = path.join(dir, 'offer.docx');
  const pdfPath = path.join(dir, 'offer.pdf');
  const loProfileDir = path.join(dir, 'lo-profile');
  const homeDir = path.join(dir, 'home');
  const cacheDir = path.join(homeDir, '.cache');

  const profileUri =
    process.platform === 'win32'
      ? `file:///${loProfileDir.replace(/\\/g, '/')}`
      : `file://${loProfileDir}`;

  try {
    await mkdir(loProfileDir, { recursive: true });
    await mkdir(cacheDir, { recursive: true });
    await writeFile(docxPath, docxBuffer);
    await execFileAsync(
      soffice,
      [
        `-env:UserInstallation=${profileUri}`,
        '--headless',
        '--convert-to',
        'pdf',
        '--outdir',
        dir,
        docxPath,
      ],
      {
        timeout: 120_000,
        maxBuffer: 50 * 1024 * 1024,
        env: {
          ...process.env,
          HOME: homeDir,
          XDG_CACHE_HOME: cacheDir,
        },
      },
    );
    return await readFile(pdfPath);
  } catch (e) {
    const msg =
      e instanceof Error
        ? e.message
        : 'Не удалось сконвертировать DOCX в PDF. Установите LibreOffice и при необходимости задайте LIBREOFFICE_PATH.';
    throw new Error(`${msg} Ожидается команда LibreOffice (soffice).`);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
