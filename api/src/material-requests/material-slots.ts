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
  /// Максимальный размер одного файла в байтах. Видео — 4 GB,
  /// изображения — 50 MB, документы — 50 MB.
  maxSizeBytes: number;
  /// Допустимые MIME — пустой массив ⇒ принимаем любые.
  allowedMimePrefixes: string[];
}

const FOUR_GB = 4 * 1024 * 1024 * 1024;
const FIFTY_MB = 50 * 1024 * 1024;

export const MATERIAL_SLOTS: MaterialSlotDef[] = [
  {
    key: 'master_video',
    label: 'Мастер-копия',
    description:
      'Финальный мастер-файл (ProRes, DCP, MXF или MP4 high-bitrate). До 4 ГБ на файл.',
    group: 'video',
    maxSizeBytes: FOUR_GB,
    allowedMimePrefixes: ['video/'],
  },
  {
    key: 'preview_video',
    label: 'Скринер / превью',
    description: 'Сжатое видео для предпросмотра (MP4 H.264, до 1080p).',
    group: 'video',
    maxSizeBytes: FOUR_GB,
    allowedMimePrefixes: ['video/'],
  },
  {
    key: 'trailer',
    label: 'Трейлер',
    description: 'Промо-ролик длительностью 1–3 минуты.',
    group: 'video',
    maxSizeBytes: FOUR_GB,
    allowedMimePrefixes: ['video/'],
  },
  {
    key: 'poster',
    label: 'Постер (вертикальный)',
    description: 'KeyArt в вертикальной ориентации, JPEG/PNG, ≥ 2000 px по длинной стороне.',
    group: 'image',
    maxSizeBytes: FIFTY_MB,
    allowedMimePrefixes: ['image/'],
  },
  {
    key: 'banner',
    label: 'Баннер (горизонтальный)',
    description: 'KeyArt 16:9 для подборок на платформе.',
    group: 'image',
    maxSizeBytes: FIFTY_MB,
    allowedMimePrefixes: ['image/'],
  },
  {
    key: 'still',
    label: 'Стиллы / кадры',
    description: 'Кадры из контента для PR и площадок.',
    group: 'image',
    maxSizeBytes: FIFTY_MB,
    allowedMimePrefixes: ['image/'],
  },
  {
    key: 'subtitles_ru',
    label: 'Субтитры RU',
    description: 'Субтитры на русском (.srt / .vtt / .ass).',
    group: 'localization',
    maxSizeBytes: FIFTY_MB,
    allowedMimePrefixes: [],
  },
  {
    key: 'subtitles_kz',
    label: 'Субтитры KZ',
    description: 'Субтитры на казахском (.srt / .vtt / .ass).',
    group: 'localization',
    maxSizeBytes: FIFTY_MB,
    allowedMimePrefixes: [],
  },
  {
    key: 'subtitles_en',
    label: 'Субтитры EN',
    description: 'Субтитры на английском (.srt / .vtt / .ass).',
    group: 'localization',
    maxSizeBytes: FIFTY_MB,
    allowedMimePrefixes: [],
  },
  {
    key: 'dub_audio',
    label: 'Дубляж (аудиодорожка)',
    description: 'Готовая дублированная звуковая дорожка отдельным файлом.',
    group: 'localization',
    maxSizeBytes: FOUR_GB,
    allowedMimePrefixes: ['audio/'],
  },
  {
    key: 'synopsis',
    label: 'Синопсис / описание',
    description: 'Текстовое описание (PDF, DOCX или TXT).',
    group: 'document',
    maxSizeBytes: FIFTY_MB,
    allowedMimePrefixes: [],
  },
  {
    key: 'chain_of_title',
    label: 'Цепочка прав (chain of title)',
    description:
      'Документы, подтверждающие права на контент (PDF, скан-копии).',
    group: 'document',
    maxSizeBytes: FIFTY_MB,
    allowedMimePrefixes: [],
  },
  {
    key: 'music_clearance',
    label: 'Очистка музыкальных прав',
    description: 'Документы, подтверждающие очистку прав на музыку.',
    group: 'document',
    maxSizeBytes: FIFTY_MB,
    allowedMimePrefixes: [],
  },
  {
    key: 'tech_specs',
    label: 'Технические параметры',
    description: 'Спецификация мастера: разрешение, кодек, битрейт, аудио.',
    group: 'document',
    maxSizeBytes: FIFTY_MB,
    allowedMimePrefixes: [],
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
