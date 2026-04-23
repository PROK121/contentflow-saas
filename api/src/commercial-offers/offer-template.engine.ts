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
 * Уменьшаем кегль примерно на 15%, чтобы оффер стабильно помещался на страницу.
 * Значения w:sz / w:szCs в DOCX заданы в half-points.
 */
function shrinkXmlFontSizes(xml: string): string {
  const scale = (raw: string): string => {
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n) || n <= 0) return raw;
    // Не опускаем ниже 9pt (18 half-points), чтобы не потерять читаемость.
    const shrunk = Math.max(18, Math.round(n * 0.85));
    return String(shrunk);
  };
  return xml
    .replace(/<w:sz w:val="(\d+)"\s*\/>/g, (_m, v: string) => {
      return `<w:sz w:val="${scale(v)}"/>`;
    })
    .replace(/<w:szCs w:val="(\d+)"\s*\/>/g, (_m, v: string) => {
      return `<w:szCs w:val="${scale(v)}"/>`;
    });
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
  zip.file('word/document.xml', xml);
  const styles = zip.file('word/styles.xml');
  if (styles) {
    const stylesXml = shrinkXmlFontSizes(styles.asText());
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
