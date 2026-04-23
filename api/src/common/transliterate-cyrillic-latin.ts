/**
 * Транслитерация кириллицы (RU/KZ и близкие символы) в латиницу для slug.
 * Дублирует web/src/lib/transliterate-cyrillic-latin.ts (общий пакет не подключён).
 */
const CYRILLIC_LOWER_TO_LATIN: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'yo',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  і: 'i',
  к: 'k',
  қ: 'q',
  л: 'l',
  м: 'm',
  н: 'n',
  ң: 'ng',
  о: 'o',
  ө: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ұ: 'u',
  ү: 'u',
  ф: 'f',
  х: 'h',
  һ: 'h',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'sch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ә: 'a',
  ю: 'yu',
  я: 'ya',
  ғ: 'g',
  ґ: 'g',
  є: 'ye',
  ї: 'yi',
  ў: 'u',
  җ: 'zh',
  ӏ: '',
};

export function transliterateCyrillicToLatin(input: string): string {
  let out = '';
  for (const ch of input.toLowerCase()) {
    out += CYRILLIC_LOWER_TO_LATIN[ch] ?? ch;
  }
  return out;
}
