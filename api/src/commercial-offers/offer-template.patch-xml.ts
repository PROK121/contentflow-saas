/** Плейсхолдеры — `[[` / `]]`, чтобы не пересекаться с разметкой Word. */
const T = {
  offerDateRu: '[[offerDateRu]]',
  workTitle: '[[workTitle]]',
  distributorLine: '[[distributorLine]]',
  contentTitle: '[[contentTitle]]',
  productionYear: '[[productionYear]]',
  contentFormat: '[[contentFormat]]',
  genre: '[[genre]]',
  seriesCount: '[[seriesCount]]',
  runtime: '[[runtime]]',
  theatricalRelease: '[[theatricalRelease]]',
  rightsHolder: '[[rightsHolder]]',
  contentLanguage: '[[contentLanguage]]',
  rightsParagraph: '[[rightsParagraph]]',
  territory: '[[territory]]',
  localization: '[[localization]]',
  materialsNote: '[[materialsNote]]',
  additionalConditions: '[[additionalConditions]]',
  licenseTerm: '[[licenseTerm]]',
  rightsOpeningProcedure: '[[rightsOpeningProcedure]]',
  remunerationKztNet: '[[remunerationKztNet]]',
  sequelFranchiseTerms: '[[sequelFranchiseTerms]]',
  paymentSchedule: '[[paymentSchedule]]',
  offerValidityDays: '[[offerValidityDays]]',
  signatoryLine: '[[signatoryLine]]',
} as const;

/**
 * Вставляет плейсхолдеры docxtemplater в оригинальный word/document.xml шаблона,
 * не меняя разметку таблиц и стилей.
 */
export function patchOfferTemplateXml(xml: string): string {
  let s = xml;

  s = s.replace(
    '«______________» (далее Произведение)',
    `«${T.workTitle}» (далее Произведение)`,
  );

  s = s.replace(
    /<w:p w14:paraId="23EB6296"[\s\S]*?<w:t(?: xml:space="preserve")?>\u00a0<\/w:t>/,
    (m) => m.replace('>\u00a0</w:t>', `>${T.offerDateRu}</w:t>`),
  );

  /** Один абзац «Дистрибьютор» для обоих шаблонов (ПО и Площадки): подставляем плейсхолдер docxtemplater. */
  const distributorPara = /<w:p w14:paraId="397BC326"[\s\S]*?<\/w:p>/;
  const distributorReplacement = `<w:p w14:paraId="397BC326" w14:textId="77777777" w:rsidR="001756BE" w:rsidRPr="001756BE" w:rsidRDefault="001756BE" w:rsidP="001756BE"><w:pPr><w:jc w:val="both"/><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:b/><w:bCs/></w:rPr><w:t>Дистрибьютор</w:t></w:r><w:r w:rsidRPr="001756BE"><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:b/><w:bCs/></w:rPr><w:t xml:space="preserve">: </w:t></w:r><w:r w:rsidRPr="00A71804"><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/></w:rPr><w:t>${T.distributorLine}</w:t></w:r></w:p>`;
  if (!distributorPara.test(s)) {
    throw new Error(
      'Шаблон оффера: не найден абзац дистрибьютора (para 397BC326). Обновите DOCX.',
    );
  }
  s = s.replace(distributorPara, distributorReplacement);

  s = s.replace(
    '<w:t xml:space="preserve"> </w:t></w:r></w:p><w:p w14:paraId="6D43585E"',
    `<w:t xml:space="preserve">${T.contentTitle}</w:t></w:r></w:p><w:p w14:paraId="6D43585E"`,
  );

  s = s.replace(
    '<w:t xml:space="preserve"> </w:t></w:r></w:p><w:p w14:paraId="61D4C771"',
    `<w:t xml:space="preserve">${T.productionYear}</w:t></w:r></w:p><w:p w14:paraId="61D4C771"`,
  );

  const valueP = (tag: string) =>
    `<w:p w14:paraId="77FFFFFF" w14:textId="77777777" w:rsidR="001756BE" w:rsidRDefault="001756BE" w:rsidP="00D77535"><w:pPr><w:jc w:val="both"/><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/></w:rPr><w:t>${tag}</w:t></w:r></w:p>`;

  s = s.replace(
    '</w:t></w:r></w:p><w:p w14:paraId="4B7DB849"',
    `</w:t></w:r></w:p>${valueP(T.contentFormat)}<w:p w14:paraId="4B7DB849"`,
  );

  s = s.replace(
    '</w:t></w:r></w:p><w:p w14:paraId="410C6DF6"',
    `</w:t></w:r></w:p>${valueP(T.genre)}<w:p w14:paraId="410C6DF6"`,
  );

  s = s.replace(
    '</w:t></w:r></w:p><w:p w14:paraId="4D06C4BD"',
    `</w:t></w:r></w:p>${valueP(T.seriesCount)}<w:p w14:paraId="4D06C4BD"`,
  );

  s = s.replace(
    '</w:t></w:r></w:p><w:p w14:paraId="4BA1F074"',
    `</w:t></w:r></w:p>${valueP(T.runtime)}<w:p w14:paraId="4BA1F074"`,
  );

  s = s.replace(
    '</w:t></w:r></w:p><w:p w14:paraId="21707752"',
    `</w:t></w:r></w:p>${valueP(T.theatricalRelease)}<w:p w14:paraId="21707752"`,
  );

  s = s.replace(
    '</w:t></w:r></w:p><w:p w14:paraId="1E9277F8"',
    `</w:t></w:r></w:p>${valueP(T.rightsHolder)}<w:p w14:paraId="1E9277F8"`,
  );

  s = s.replace(
    /(<w:p w14:paraId="1E9277F8"[\s\S]*?<\/w:p>)(<\/w:tc>)/,
    `$1${valueP(T.contentLanguage)}$2`,
  );

  // В строке "Права" оставляем только выбранный формат лицензии.
  s = s.replace(
    /Исключительные права\s*\/\s*Не исключительные права/g,
    T.rightsParagraph,
  );

  // Держим в абзаце "Права" выбранный формат лицензии (не затираем пустым абзацем).
  const rightsPara = `<w:p w14:paraId="28B9EE87" w14:textId="34759211" w:rsidR="001756BE" w:rsidRPr="001756BE" w:rsidRDefault="001756BE" w:rsidP="00D77535"><w:pPr><w:jc w:val="both"/><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/></w:rPr><w:t>${T.rightsParagraph}</w:t></w:r></w:p>`;

  s = s.replace(/<w:p w14:paraId="28B9EE87"[\s\S]*?<\/w:p>/, rightsPara);

  const territoryPara = `<w:p w14:paraId="2C326910" w14:textId="77777777" w:rsidR="001756BE" w:rsidRPr="001756BE" w:rsidRDefault="001756BE" w:rsidP="00D77535"><w:pPr><w:jc w:val="both"/><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/></w:rPr></w:pPr><w:r w:rsidRPr="001756BE"><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/></w:rPr><w:t>${T.territory}</w:t></w:r></w:p>`;

  s = s.replace(/<w:p w14:paraId="2C326910"[\s\S]*?<\/w:p>/, territoryPara);

  const locPara = `<w:p w14:paraId="7AFC3F92" w14:textId="2A2A8F39" w:rsidR="001756BE" w:rsidRPr="00A71804" w:rsidRDefault="001756BE" w:rsidP="00D77535"><w:pPr><w:jc w:val="both"/><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/></w:rPr><w:t>${T.localization}</w:t></w:r></w:p>`;

  s = s.replace(/<w:p w14:paraId="7AFC3F92"[\s\S]*?<\/w:p>/, locPara);

  s = s.replace(
    '- промо материалы</w:t></w:r></w:p></w:tc>',
    `- промо материалы</w:t></w:r></w:p>${valueP(T.materialsNote)}</w:tc>`,
  );

  const additionalPara = `<w:p w14:paraId="482B0D44" w14:textId="77777777" w:rsidR="001756BE" w:rsidRDefault="001756BE" w:rsidP="00D77535"><w:pPr><w:jc w:val="both"/><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/></w:rPr><w:t>${T.additionalConditions}</w:t></w:r></w:p>`;

  s = s.replace(
    /<w:p w14:paraId="482B0D44"[\s\S]*?<w:p w14:paraId="33B37C32"[\s\S]*?<\/w:p>/,
    additionalPara,
  );

  const licensePara = `<w:p w14:paraId="4300DAD5" w14:textId="77777777" w:rsidR="001756BE" w:rsidRPr="001756BE" w:rsidRDefault="001756BE" w:rsidP="00D77535"><w:pPr><w:jc w:val="both"/><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/></w:rPr></w:pPr><w:r w:rsidRPr="001756BE"><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/></w:rPr><w:t>${T.licenseTerm}</w:t></w:r></w:p>`;

  s = s.replace(/<w:p w14:paraId="4300DAD5"[\s\S]*?<\/w:p>/, licensePara);

  const rightsOpeningProcedurePara = `<w:p w14:paraId="60AB730B" w14:textId="77777777" w:rsidR="001756BE" w:rsidRPr="00A71804" w:rsidRDefault="001756BE" w:rsidP="00D77535"><w:pPr><w:jc w:val="both"/><w:rPr><w:rFonts w:ascii="Times New Roman" w:eastAsia="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:color w:val="000000"/><w:lang w:eastAsia="ru-RU"/></w:rPr></w:pPr><w:r w:rsidRPr="00A71804"><w:rPr><w:rFonts w:ascii="Times New Roman" w:eastAsia="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:color w:val="000000"/><w:lang w:eastAsia="ru-RU"/></w:rPr><w:t xml:space="preserve">${T.rightsOpeningProcedure}</w:t></w:r></w:p>`;
  s = s.replace(
    /<w:p w14:paraId="60AB730B"[\s\S]*?<\/w:p>/,
    rightsOpeningProcedurePara,
  );

  const remunerationPara = `<w:p w14:paraId="0FF68C2E" w14:textId="77777777" w:rsidR="001756BE" w:rsidRPr="00A71804" w:rsidRDefault="001756BE" w:rsidP="00D77535"><w:pPr><w:jc w:val="both"/><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/></w:rPr><w:t>${T.remunerationKztNet}</w:t></w:r></w:p>`;
  s = s.replace(
    /<w:p w14:paraId="0FF68C2E"[\s\S]*?<\/w:p>/,
    remunerationPara,
  );

  const sequelPara = `<w:p w14:paraId="21D0E527" w14:textId="77777777" w:rsidR="001756BE" w:rsidRDefault="001756BE" w:rsidP="00D77535"><w:pPr><w:jc w:val="both"/><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/></w:rPr><w:t>${T.sequelFranchiseTerms}</w:t></w:r></w:p>`;

  s = s.replace(/<w:p w14:paraId="21D0E527"[\s\S]*?<\/w:p>/, sequelPara);

  const payPara = `<w:p w14:paraId="63E3A09E" w14:textId="77777777" w:rsidR="001756BE" w:rsidRDefault="001756BE" w:rsidP="00D77535"><w:pPr><w:jc w:val="both"/><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/></w:rPr><w:t>${T.paymentSchedule}</w:t></w:r></w:p>`;

  s = s.replace(/<w:p w14:paraId="63E3A09E"[\s\S]*?<\/w:p>/, payPara);

  s = s.replace(
    '** Предложение действительно 7 дней с момента отправки. ',
    `** Предложение действительно ${T.offerValidityDays} дней с момента отправки. `,
  );

  s = s.replace(
    '<w:t>________________________</w:t>',
    `<w:t>${T.signatoryLine}</w:t>`,
  );

  return s;
}
