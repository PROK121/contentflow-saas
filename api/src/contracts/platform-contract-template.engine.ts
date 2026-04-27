import { readFileSync } from 'fs';
import { convertDocxBufferToPdf } from '../commercial-offers/libreoffice-pdf';
import PizZip = require('pizzip');
import * as path from 'path';

type TemplateData = {
  contractNumber: string;
  contractDateRu: string;
  licensorName: string;
  contentTitle: string;
  amountKzt: string;
};

function templatePath(file: string): string {
  return path.join(process.cwd(), 'templates', file);
}

function formatDateRu(date: Date): string {
  return date.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function applyTextReplacements(xml: string, data: TemplateData): string {
  let out = xml;
  out = out.replaceAll('датА', data.contractDateRu);
  out = out.replace(
    'Номер: Дата заключения:',
    `Номер: ${data.contractNumber} Дата заключения:`,
  );
  out = out.replace('Полное наименование компании либо ИП', data.licensorName);
  out = out.replace('«Черная икра» (Kara Bekire)', data.contentTitle);
  out = out.replace(
    /Размер Вознаграждения[\s\S]*?\(без учета НДС\)/,
    (m) => m.replace('(без учета НДС)', `(без учета НДС) ${data.amountKzt}`),
  );
  return out;
}

function renderDocxFromTemplate(file: string, data: TemplateData): Buffer {
  const zip = new PizZip(readFileSync(templatePath(file)));
  const documentXml = zip.file('word/document.xml');
  if (!documentXml) throw new Error(`В шаблоне ${file} нет word/document.xml`);
  const patched = applyTextReplacements(documentXml.asText(), data);
  zip.file('word/document.xml', patched);
  return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
}

export async function renderKinopoiskContractPdfs(input: {
  contractNumber: string;
  contractDate: Date;
  licensorName: string;
  contentTitle: string;
  amountKzt: string;
}): Promise<{ contractPdf: Buffer; appendixPdf: Buffer }> {
  const data: TemplateData = {
    contractNumber: input.contractNumber,
    contractDateRu: formatDateRu(input.contractDate),
    licensorName: input.licensorName,
    contentTitle: input.contentTitle,
    amountKzt: input.amountKzt,
  };
  const contractDocx = renderDocxFromTemplate(
    'contract-platform-kinopoisk.docx',
    data,
  );
  const appendixDocx = renderDocxFromTemplate(
    'contract-platform-kinopoisk-appendix.docx',
    data,
  );
  const [contractPdf, appendixPdf] = await Promise.all([
    convertDocxBufferToPdf(contractDocx),
    convertDocxBufferToPdf(appendixDocx),
  ]);
  return { contractPdf, appendixPdf };
}

