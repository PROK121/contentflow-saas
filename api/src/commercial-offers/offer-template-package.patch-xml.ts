/** Плейсхолдеры для шаблона «Пакет площадок». */
const T = {
  offerDateRu: '[[offerDateRu]]',
  workTitle: '[[workTitle]]',
  distributorLine: '[[distributorLine]]',
  clientLegalName: '[[clientLegalName]]',
  rightsParagraph: '[[rightsParagraph]]',
  rightsPlatforms: '[[rightsPlatforms]]',
  territory: '[[territory]]',
  localization: '[[localization]]',
  materialsNote: '[[materialsNote]]',
  additionalConditions: '[[additionalConditions]]',
  licenseTerm: '[[licenseTerm]]',
  rightsOpeningProcedure: '[[rightsOpeningProcedure]]',
  remunerationKztNet: '[[remunerationKztNet]]',
  paymentSchedule: '[[paymentSchedule]]',
  offerValidityDays: '[[offerValidityDays]]',
  signatoryLine: '[[signatoryLine]]',
} as const;

/** Вспомогательный XML для одной ячейки с нильными границами (внутренними). */
function pBdr(): string {
  return '<w:pBdr><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:between w:val="nil"/></w:pBdr>';
}
function rPrTimes(extraColor = true): string {
  const color = extraColor ? '<w:color w:val="000000"/>' : '';
  return `<w:rFonts w:ascii="Times New Roman" w:eastAsia="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>${color}`;
}

/**
 * Строка-шаблон для повторения через docxtemplater (одна строка на тайтл).
 * Использует теги [[#titles]]…[[/titles]].
 */
function buildLoopRow(): string {
  const rPr = `<w:rPr>${rPrTimes()}</w:rPr>`;
  const pPrBase = `<w:pPr>${pBdr()}${rPr}</w:pPr>`;

  function cell(width: number, extra: string, tag: string, pidSuffix: string): string {
    return (
      `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${extra}</w:tcPr>` +
      `<w:p w14:paraId="AA0000${pidSuffix}" w14:textId="77777777" w:rsidR="00A2620A" w:rsidRDefault="00A2620A" w:rsidP="000F627F">` +
      `${pPrBase}` +
      `<w:r>${rPr}<w:t>${tag}</w:t></w:r>` +
      `</w:p></w:tc>`
    );
  }

  const borderRight = '<w:tcBorders><w:right w:val="single" w:sz="4" w:space="0" w:color="auto"/></w:tcBorders>';
  const borderLeft = '<w:tcBorders><w:left w:val="single" w:sz="4" w:space="0" w:color="auto"/></w:tcBorders>';
  const borderRightBlack = '<w:tcBorders><w:right w:val="single" w:sz="4" w:space="0" w:color="000000"/></w:tcBorders>';
  const borderFull7 = '<w:tcBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:left w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:right w:val="single" w:sz="4" w:space="0" w:color="auto"/></w:tcBorders>';
  const borderFull8 = '<w:tcBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:left w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:right w:val="single" w:sz="4" w:space="0" w:color="auto"/></w:tcBorders>';
  const borderFull9 = '<w:tcBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:left w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:right w:val="single" w:sz="4" w:space="0" w:color="000000"/></w:tcBorders>';

  return (
    `<w:tr w:rsidR="00A2620A" w14:paraId="AA000001" w14:textId="77777777" w:rsidTr="00A2620A">` +
    cell(458, '', '[[#titles]][[rowNum]]', '01') +
    cell(2803, '<w:vAlign w:val="bottom"/>', '[[title]]', '02') +
    cell(1134, `${borderRight}<w:vAlign w:val="center"/>`, '[[seriesCount]]', '03') +
    cell(1701, `${borderLeft}<w:vAlign w:val="center"/>`, '[[genre]]', '04') +
    cell(1275, '<w:vAlign w:val="bottom"/>', '[[runtime]]', '05') +
    cell(993, `${borderRightBlack}<w:vAlign w:val="bottom"/>`, '[[productionYear]]', '06') +
    cell(2268, `${borderFull7}<w:vAlign w:val="center"/>`, '[[theatricalRelease]]', '07') +
    cell(1559, `${borderFull8}<w:vAlign w:val="center"/>`, '[[language]]', '08') +
    cell(1984, `${borderFull9}<w:vAlign w:val="center"/>`, '[[price]][[/titles]]', '09') +
    `</w:tr>`
  );
}

function simpleValuePara(paraId: string, tag: string): string {
  return (
    `<w:p w14:paraId="${paraId}" w14:textId="77777777" w:rsidR="001756BE" w:rsidRDefault="001756BE" w:rsidP="00D77535">` +
    `<w:pPr><w:jc w:val="both"/><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/></w:rPr></w:pPr>` +
    `<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/></w:rPr><w:t>${tag}</w:t></w:r>` +
    `</w:p>`
  );
}

/**
 * Вставляет плейсхолдеры docxtemplater в word/document.xml шаблона «Пакет площадок».
 */
export function patchPackageTemplateXml(xml: string): string {
  let s = xml;

  // 1. Дата: добавляем [[offerDateRu]] в абзац 1AC52AB0
  s = s.replace(
    /<w:p w14:paraId="1AC52AB0"[\s\S]*?<\/w:p>/,
    `<w:p w14:paraId="1AC52AB0" w14:textId="77777777" w:rsidR="001756BE" w:rsidRDefault="001756BE" w:rsidP="001756BE">` +
    `<w:pPr><w:spacing w:line="216" w:lineRule="atLeast"/><w:ind w:firstLine="525"/><w:jc w:val="both"/>` +
    `<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:color w:val="000000"/></w:rPr></w:pPr>` +
    `<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:color w:val="000000"/></w:rPr>` +
    `<w:t xml:space="preserve">Дата: ${T.offerDateRu}</w:t></w:r></w:p>`,
  );

  // 2. «______________» (далее Произведения) — абзац 4E1E09B9
  //    Текст разбит на несколько runs, поэтому заменяем весь абзац целиком.
  s = s.replace(
    /<w:p w14:paraId="4E1E09B9"[\s\S]*?<\/w:p>/,
    `<w:p w14:paraId="4E1E09B9" w14:textId="77777777" w:rsidR="001756BE" w:rsidRDefault="001756BE" w:rsidP="001756BE">` +
    `<w:pPr><w:spacing w:line="216" w:lineRule="atLeast"/><w:ind w:firstLine="525"/><w:jc w:val="center"/>` +
    `<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:b/><w:bCs/><w:color w:val="000000"/></w:rPr></w:pPr>` +
    `<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:b/><w:bCs/><w:color w:val="000000"/></w:rPr>` +
    `<w:t>«${T.workTitle}» (далее Произведения)</w:t></w:r></w:p>`,
  );

  // 3. Дистрибьютор (абзац 397BC326) — общий с другими шаблонами
  const distributorPara = /<w:p w14:paraId="397BC326"[\s\S]*?<\/w:p>/;
  const distributorReplacement =
    `<w:p w14:paraId="397BC326" w14:textId="77777777" w:rsidR="001756BE" w:rsidRDefault="001756BE" w:rsidP="001756BE">` +
    `<w:pPr><w:jc w:val="both"/><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/></w:rPr></w:pPr>` +
    `<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:b/><w:bCs/></w:rPr><w:t>Дистрибьютор</w:t></w:r>` +
    `<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:b/><w:bCs/></w:rPr><w:t xml:space="preserve">: </w:t></w:r>` +
    `<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/></w:rPr><w:t>${T.distributorLine}</w:t></w:r>` +
    `</w:p>`;
  s = s.replace(distributorPara, distributorReplacement);

  // 4. Лицензиат (абзац 2598FEFE)
  s = s.replace(
    /<w:p w14:paraId="2598FEFE"[\s\S]*?<\/w:p>/,
    `<w:p w14:paraId="2598FEFE" w14:textId="77777777" w:rsidR="00E14C59" w:rsidRDefault="00E14C59" w:rsidP="001756BE">` +
    `<w:pPr><w:jc w:val="both"/><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:b/><w:bCs/></w:rPr></w:pPr>` +
    `<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:b/><w:bCs/></w:rPr><w:t xml:space="preserve">Лицензиат: </w:t></w:r>` +
    `<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/></w:rPr><w:t>${T.clientLegalName}</w:t></w:r>` +
    `</w:p>`,
  );

  // 5. Заменяем 5 статических строк данных одной строкой-шаблоном для цикла
  const loopRow = buildLoopRow();
  s = s.replace(
    /<w:tr[^>]*w14:paraId="11704071"[\s\S]*?w14:paraId="2AEEF84E"[\s\S]*?<\/w:tr>/,
    loopRow,
  );

  // 6. Строка «Права»: заменяем текст в ячейке значений
  //    Первый абзац (33C006F9): «Исключительные права/Не исключительные права»
  s = s.replace(
    /Исключительные права\s*\/\s*Не исключительные права/g,
    T.rightsParagraph,
  );
  //    Второй абзац (28B9EE87): VOD/AVOD/... → rightsPlatforms
  s = s.replace(
    /<w:p w14:paraId="28B9EE87"[\s\S]*?<\/w:p>/,
    simpleValuePara('28B9EE87', T.rightsPlatforms),
  );

  // 7. Территория (абзац 2C326910)
  s = s.replace(
    /<w:p w14:paraId="2C326910"[\s\S]*?<\/w:p>/,
    simpleValuePara('2C326910', T.territory),
  );

  // 8. Права на локализацию (абзац 7AFC3F92)
  s = s.replace(
    /<w:p w14:paraId="7AFC3F92"[\s\S]*?<\/w:p>/,
    simpleValuePara('7AFC3F92', T.localization),
  );

  // 9. Дополнительные условия (абзацы 482B0D44 + 33B37C32 — оба в одной ячейке)
  s = s.replace(
    /<w:p w14:paraId="482B0D44"[\s\S]*?<w:p w14:paraId="33B37C32"[\s\S]*?<\/w:p>/,
    simpleValuePara('482B0D44', T.additionalConditions),
  );

  // 10. Лицензионный срок (абзац 4300DAD5)
  s = s.replace(
    /<w:p w14:paraId="4300DAD5"[\s\S]*?<\/w:p>/,
    simpleValuePara('4300DAD5', T.licenseTerm),
  );

  // 11. Порядок открытия прав (абзац 60AB730B)
  s = s.replace(
    /<w:p w14:paraId="60AB730B"[\s\S]*?<\/w:p>/,
    simpleValuePara('60AB730B', T.rightsOpeningProcedure),
  );

  // 12. Вознаграждение KZT (абзац 0FF68C2E)
  s = s.replace(
    /<w:p w14:paraId="0FF68C2E"[\s\S]*?<\/w:p>/,
    simpleValuePara('0FF68C2E', T.remunerationKztNet),
  );

  // 13. Материалы (абзац 21D0E527) — в пакетном шаблоне это «materialsNote», не «sequel»!
  s = s.replace(
    /<w:p w14:paraId="21D0E527"[\s\S]*?<\/w:p>/,
    simpleValuePara('21D0E527', T.materialsNote),
  );

  // 14. График платежей (абзац 63E3A09E)
  s = s.replace(
    /<w:p w14:paraId="63E3A09E"[\s\S]*?<\/w:p>/,
    simpleValuePara('63E3A09E', T.paymentSchedule),
  );

  // 15. Срок действия предложения
  s = s.replace(
    '** Предложение действительно 7 дней с момента отправки. ',
    `** Предложение действительно ${T.offerValidityDays} дней с момента отправки. `,
  );

  // 16. Подпись (первое вхождение «________________________» — сторона лицензиата)
  s = s.replace(
    '<w:t>________________________</w:t>',
    `<w:t>${T.signatoryLine}</w:t>`,
  );

  return s;
}
