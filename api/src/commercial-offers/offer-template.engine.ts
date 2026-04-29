import { readFileSync } from 'fs';
import * as path from 'path';
import Docxtemplater = require('docxtemplater');
import PizZip = require('pizzip');
import { CreateCommercialOfferDto } from './dto/create-commercial-offer.dto';
import { convertDocxBufferToPdf } from './libreoffice-pdf';
import { offerDtoToTemplateData } from './offer-template.data';
import { patchOfferTemplateXml } from './offer-template.patch-xml';

export type OfferTemplateVariant = 'po' | 'platforms';

const patchedZips: Partial<Record<OfferTemplateVariant, Buffer>> = {};

/**
 * Уменьшаем кегль на ~20%, чтобы оффер стабильно помещался на одну страницу.
 * Значения w:sz / w:szCs в DOCX заданы в half-points (1pt = 2 half-points).
 */
function shrinkXmlFontSizes(xml: string): string {
  const scale = (raw: string): string => {
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n) || n <= 0) return raw;
    // Не опускаем ниже 9pt (18 half-points), чтобы сохранить читаемость.
    const shrunk = Math.max(18, Math.round(n * 0.80));
    return String(shrunk);
  };
  return xml
    .replace(/<w:sz w:val="(\d+)"\s*\/>/g, (_m, v: string) => `<w:sz w:val="${scale(v)}"/>`)
    .replace(/<w:szCs w:val="(\d+)"\s*\/>/g, (_m, v: string) => `<w:szCs w:val="${scale(v)}"/>`);
}

/**
 * Уменьшаем поля страницы до минимально приемлемых значений.
 * Единица — twips (1 см = 567 twips, 1 дюйм = 1440 twips).
 * Целевые поля: верх/низ 720 twips (~1.27 см), лево/право 900 twips (~1.59 см).
 */
function shrinkPageMargins(xml: string): string {
  return xml.replace(/<w:pgMar\s[^>]*\/>/g, (match) => {
    let m = match;
    const cap = (attr: string, max: number) => {
      m = m.replace(new RegExp(`(${attr}=)"(\\d+)"`), (_, a, v) =>
        `${a}"${Math.min(Number(v), max)}"`,
      );
    };
    cap('w:top', 720);
    cap('w:bottom', 720);
    cap('w:left', 900);
    cap('w:right', 900);
    cap('w:header', 360);
    cap('w:footer', 360);
    return m;
  });
}

/**
 * Убираем лишние отступы между абзацами (w:before / w:after).
 * Ограничиваем до 40 twips (~0.07 см), чтобы не слипались строки.
 */
function shrinkParagraphSpacing(xml: string): string {
  return xml
    .replace(/w:before="(\d+)"/g, (_, v) =>
      `w:before="${Math.min(Number(v), 40)}"`,
    )
    .replace(/w:after="(\d+)"/g, (_, v) =>
      `w:after="${Math.min(Number(v), 40)}"`,
    );
}

function templatePath(variant: OfferTemplateVariant): string {
  const file =
    variant === 'platforms'
      ? 'offer-platforms-template.docx'
      : 'offer-po-template.docx';
  return path.join(process.cwd(), 'templates', file);
}

function getPatchedTemplateZip(variant: OfferTemplateVariant): Buffer {
  const cached = patchedZips[variant];
  if (cached) return cached;
  const zip = new PizZip(readFileSync(templatePath(variant)));
  const f = zip.file('word/document.xml');
  if (!f) throw new Error('В шаблоне нет word/document.xml');
  let xml = f.asText();
  xml = patchOfferTemplateXml(xml);
  xml = shrinkXmlFontSizes(xml);
  xml = shrinkPageMargins(xml);
  xml = shrinkParagraphSpacing(xml);
  zip.file('word/document.xml', xml);
  const styles = zip.file('word/styles.xml');
  if (styles) {
    let stylesXml = styles.asText();
    stylesXml = shrinkXmlFontSizes(stylesXml);
    stylesXml = shrinkParagraphSpacing(stylesXml);
    zip.file('word/styles.xml', stylesXml);
  }
  const buf = zip.generate({
    type: 'nodebuffer',
    compression: 'DEFLATE',
  });
  patchedZips[variant] = buf;
  return buf;
}

export function renderOfferDocxFromDto(
  dto: CreateCommercialOfferDto,
  variant: OfferTemplateVariant = 'po',
): Buffer {
  const zip = new PizZip(getPatchedTemplateZip(variant));
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: '[[', end: ']]' },
  });
  try {
    doc.render(offerDtoToTemplateData(dto));
  } catch (e) {
    const err = e as { properties?: { errors?: unknown } };
    throw new Error(
      `Ошибка заполнения шаблона: ${JSON.stringify(err.properties?.errors ?? err)}`,
    );
  }
  return doc.getZip().generate({
    type: 'nodebuffer',
    compression: 'DEFLATE',
  });
}

export async function renderOfferPdfFromDto(
  dto: CreateCommercialOfferDto,
  variant: OfferTemplateVariant = 'po',
): Promise<Buffer> {
  const docx = renderOfferDocxFromDto(dto, variant);
  return convertDocxBufferToPdf(docx);
}
