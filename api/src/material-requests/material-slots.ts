/// Каталог типов материалов (слотов), которые менеджер может запрашивать у
/// правообладателя. Здесь же — ограничения по размеру и допустимым MIME.
///
/// Слоты сознательно стандартизированы: на бэке мы валидируем slot из
/// MaterialUpload по этому списку, на фронте показываем чек-лист.

export interface MaterialSlotDef {
  /// Технический ключ — храним в БД и сравниваем при upload.
  key: string;
  /// Подпись для UI (русская).
  label: string;
  /// Расширенное пояснение для UI (что именно загружать).
  description: string;
  /// Группа (для секций UI: «видео», «графика», «документы», «локализация»).
  group: 'video' | 'image' | 'localization' | 'document';
  /// Максимальный размер одного файла в байтах.
  /// Лимит 4 ГБ универсальный — крупные мастера в перспективе через
  /// pre-signed S3-URL, а не синхронный multipart upload через API.
  maxSizeBytes: number;
  /// Допустимые MIME — пустой массив ⇒ принимаем любые.
  allowedMimePrefixes: string[];
  /// Допустимые расширения файла (lowercase, с точкой). Пустой массив ⇒
  /// расширение не проверяем (для документов/субтитров возможны разные).
  allowedExtensions: string[];
}

const FOUR_GB = 4 * 1024 * 1024 * 1024;
const ONE_GB = 1024 * 1024 * 1024;
const FIFTY_MB = 50 * 1024 * 1024;

const VIDEO_EXT = ['.mp4', '.mov', '.mkv', '.mxf', '.m4v', '.webm'];
const IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.tif', '.tiff'];
const SUBS_EXT = ['.srt', '.vtt', '.ass', '.ssa'];
const AUDIO_EXT = ['.wav', '.mp3', '.aac', '.flac', '.m4a', '.ogg'];
const DOC_EXT = ['.pdf', '.docx', '.doc', '.txt', '.rtf'];

export const MATERIAL_SLOTS: MaterialSlotDef[] = [
  {
    key: 'master_video',
    label: 'Мастер-копия',
    description:
      'Финальный мастер-файл (ProRes, DCP, MXF или MP4 high-bitrate). До 4 ГБ синхронно; крупнее — через pre-signed URL.',
    group: 'video',
    maxSizeBytes: FOUR_GB,
    allowedMimePrefixes: ['video/', 'application/mxf', 'application/octet-stream'],
    allowedExtensions: VIDEO_EXT,
  },
  {
    key: 'preview_video',
    label: 'Скринер / превью',
    description: 'Сжатое видео для предпросмотра (MP4 H.264, до 1080p). До 1 ГБ.',
    group: 'video',
    maxSizeBytes: ONE_GB,
    allowedMimePrefixes: ['video/'],
    allowedExtensions: VIDEO_EXT,
  },
  {
    key: 'trailer',
    label: 'Трейлер',
    description: 'Промо-ролик длительностью 1–3 минуты. До 1 ГБ.',
    group: 'video',
    maxSizeBytes: ONE_GB,
    allowedMimePrefixes: ['video/'],
    allowedExtensions: VIDEO_EXT,
  },
  {
    key: 'poster',
    label: 'Постер (вертикальный)',
    description: 'KeyArt в вертикальной ориентации, JPEG/PNG, ≥ 2000 px по длинной стороне.',
    group: 'image',
    maxSizeBytes: FIFTY_MB,
    allowedMimePrefixes: ['image/'],
    allowedExtensions: IMAGE_EXT,
  },
  {
    key: 'banner',
    label: 'Баннер (горизонтальный)',
    description: 'KeyArt 16:9 для подборок на платформе.',
    group: 'image',
    maxSizeBytes: FIFTY_MB,
    allowedMimePrefixes: ['image/'],
    allowedExtensions: IMAGE_EXT,
  },
  {
    key: 'still',
    label: 'Стиллы / кадры',
    description: 'Кадры из контента для PR и площадок.',
    group: 'image',
    maxSizeBytes: FIFTY_MB,
    allowedMimePrefixes: ['image/'],
    allowedExtensions: IMAGE_EXT,
  },
  {
    key: 'subtitles_ru',
    label: 'Субтитры RU',
    description: 'Субтитры на русском (.srt / .vtt / .ass).',
    group: 'localization',
    maxSizeBytes: FIFTY_MB,
    allowedMimePrefixes: ['text/', 'application/x-subrip'],
    allowedExtensions: SUBS_EXT,
  },
  {
    key: 'subtitles_kz',
    label: 'Субтитры KZ',
    description: 'Субтитры на казахском (.srt / .vtt / .ass).',
    group: 'localization',
    maxSizeBytes: FIFTY_MB,
    allowedMimePrefixes: ['text/', 'application/x-subrip'],
    allowedExtensions: SUBS_EXT,
  },
  {
    key: 'subtitles_en',
    label: 'Субтитры EN',
    description: 'Субтитры на английском (.srt / .vtt / .ass).',
    group: 'localization',
    maxSizeBytes: FIFTY_MB,
    allowedMimePrefixes: ['text/', 'application/x-subrip'],
    allowedExtensions: SUBS_EXT,
  },
  {
    key: 'dub_audio',
    label: 'Дубляж (аудиодорожка)',
    description: 'Готовая дублированная звуковая дорожка отдельным файлом.',
    group: 'localization',
    maxSizeBytes: ONE_GB,
    allowedMimePrefixes: ['audio/'],
    allowedExtensions: AUDIO_EXT,
  },
  {
    key: 'synopsis',
    label: 'Синопсис / описание',
    description: 'Текстовое описание (PDF, DOCX или TXT).',
    group: 'document',
    maxSizeBytes: FIFTY_MB,
    allowedMimePrefixes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument', 'text/'],
    allowedExtensions: DOC_EXT,
  },
  {
    key: 'chain_of_title',
    label: 'Цепочка прав (chain of title)',
    description:
      'Документы, подтверждающие права на контент (PDF, скан-копии).',
    group: 'document',
    maxSizeBytes: FIFTY_MB,
    allowedMimePrefixes: ['application/pdf', 'image/', 'application/msword', 'application/vnd.openxmlformats-officedocument'],
    allowedExtensions: [...DOC_EXT, ...IMAGE_EXT],
  },
  {
    key: 'music_clearance',
    label: 'Очистка музыкальных прав',
    description: 'Документы, подтверждающие очистку прав на музыку.',
    group: 'document',
    maxSizeBytes: FIFTY_MB,
    allowedMimePrefixes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument'],
    allowedExtensions: DOC_EXT,
  },
  {
    key: 'tech_specs',
    label: 'Технические параметры',
    description: 'Спецификация мастера: разрешение, кодек, битрейт, аудио.',
    group: 'document',
    maxSizeBytes: FIFTY_MB,
    allowedMimePrefixes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument', 'text/'],
    allowedExtensions: DOC_EXT,
  },
];

const SLOT_BY_KEY = new Map(MATERIAL_SLOTS.map((s) => [s.key, s]));

export function getSlotDef(key: string): MaterialSlotDef | undefined {
  return SLOT_BY_KEY.get(key);
}

export function isValidSlot(key: string): boolean {
  return SLOT_BY_KEY.has(key);
}

/// Возвращает максимальный размер для слота (или общий — 4 ГБ если слот неизвестен).
export function maxSizeForSlot(key: string): number {
  return SLOT_BY_KEY.get(key)?.maxSizeBytes ?? FOUR_GB;
}

/// Проверяет, что MIME файла соответствует слоту. Пустой allowedMimePrefixes
/// ⇒ слот принимает любой формат (документы / субтитры).
export function isMimeAllowedForSlot(slot: string, mime: string): boolean {
  const def = SLOT_BY_KEY.get(slot);
  if (!def) return false;
  if (def.allowedMimePrefixes.length === 0) return true;
  return def.allowedMimePrefixes.some((p) => mime.startsWith(p));
}

/// Проверяет, что расширение файла из originalname разрешено для слота.
/// Без extension-whitelist можно подсунуть `master.exe` под видом `master.mp4`,
/// MIME многие multipart-клиенты не выставляют корректно.
export function isExtensionAllowedForSlot(
  slot: string,
  originalName: string,
): boolean {
  const def = SLOT_BY_KEY.get(slot);
  if (!def) return false;
  if (def.allowedExtensions.length === 0) return true;
  const lower = originalName.toLowerCase();
  return def.allowedExtensions.some((ext) => lower.endsWith(ext));
}

/// Минимальная проверка по «магическим байтам» начала файла. Не панацея,
/// но отсекает грубую подмену расширения. Возвращает обнаруженный тип
/// или null, если не распознан. Сюда нужно передавать первые ~32 байта файла.
export function detectFileSignature(head: Buffer): string | null {
  if (head.length < 4) return null;
  // Несколько распространённых сигнатур (см. https://en.wikipedia.org/wiki/List_of_file_signatures).
  const startsWith = (bytes: number[]) =>
    bytes.every((b, i) => head[i] === b);
  const startsWithAt = (offset: number, bytes: number[]) =>
    bytes.every((b, i) => head[offset + i] === b);
  if (startsWith([0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith([0x89, 0x50, 0x4e, 0x47])) return 'image/png';
  if (startsWith([0x47, 0x49, 0x46, 0x38])) return 'image/gif';
  if (startsWith([0x52, 0x49, 0x46, 0x46]) && startsWithAt(8, [0x57, 0x45, 0x42, 0x50])) return 'image/webp';
  if (startsWith([0x25, 0x50, 0x44, 0x46])) return 'application/pdf';
  if (startsWith([0x50, 0x4b, 0x03, 0x04])) return 'application/zip'; // docx/xlsx/zip
  // ftyp box у MP4/MOV
  if (head.length >= 12 && startsWithAt(4, [0x66, 0x74, 0x79, 0x70])) return 'video/mp4';
  if (startsWith([0x49, 0x44, 0x33])) return 'audio/mpeg'; // ID3 tag
  if (startsWith([0x4f, 0x67, 0x67, 0x53])) return 'audio/ogg';
  if (startsWith([0x66, 0x4c, 0x61, 0x43])) return 'audio/flac';
  return null;
}
