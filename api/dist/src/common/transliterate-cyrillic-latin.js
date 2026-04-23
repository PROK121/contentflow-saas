"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transliterateCyrillicToLatin = transliterateCyrillicToLatin;
const CYRILLIC_LOWER_TO_LATIN = {
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
function transliterateCyrillicToLatin(input) {
    let out = '';
    for (const ch of input.toLowerCase()) {
        out += CYRILLIC_LOWER_TO_LATIN[ch] ?? ch;
    }
    return out;
}
//# sourceMappingURL=transliterate-cyrillic-latin.js.map