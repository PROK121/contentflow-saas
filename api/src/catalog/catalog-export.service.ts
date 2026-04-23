import { Injectable, InternalServerErrorException } from '@nestjs/common';
import type { CatalogItem, LicenseTerm, Organization } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import PDFDocument = require('pdfkit');
import { CLOSED_DEAL_STAGES } from '../deals/rights-validation';
import { PrismaService } from '../prisma/prisma.service';
import { CatalogService } from './catalog.service';
import { formatLicenseTermCell } from './license-term-format';

type ItemWithRelations = CatalogItem & {
  rightsHolder: Organization;
  licenseTerms: LicenseTerm[];
};

const ASSET_RU: Record<string, string> = {
  video: 'Фильмы',
  series: 'Сериалы',
  animated_series: 'Анимационные сериалы',
  animated_film: 'Анимационные фильмы',
  anime_series: 'Анимэ (сериалы)',
  anime_film: 'Анимэ фильмы',
  concert_show: 'Концерты/Шоу',
};

const STATUS_RU: Record<string, string> = {
  draft: 'Черновик',
  active: 'Активен',
  archived: 'Архив',
};

const EXCL_RU: Record<string, string> = {
  exclusive: 'Исключительные права',
  co_exclusive: 'Ко-эксклюзив',
  non_exclusive: 'Не исключительные права',
  sole: 'Sole (исключительные права правообладателя)',
};

function fmtDateRu(iso: Date | string | null | undefined): string {
  if (!iso) return '—';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('ru-RU');
}

function formatDurationRu(terms: LicenseTerm[]): string {
  if (!terms.length) return '—';
  const parts = terms.map((t) =>
    formatLicenseTermCell(t.durationMonths, t.startAt, t.endAt),
  );
  const uniq = [...new Set(parts)];
  return uniq.length ? uniq.join('; ') : '—';
}

function territoriesLine(terms: LicenseTerm[]): string {
  const codes = [...new Set(terms.map((t) => t.territoryCode))];
  return codes.length ? codes.join(', ') : '—';
}

function allPlatforms(terms: LicenseTerm[]): string {
  const p = [...new Set(terms.flatMap((t) => [...t.platforms]))];
  return p.length ? p.join(', ') : '—';
}

function hasExclusive(terms: LicenseTerm[]): boolean {
  return terms.some((t) => t.exclusivity === 'exclusive');
}

@Injectable()
export class CatalogExportService {
  constructor(
    private readonly catalog: CatalogService,
    private readonly prisma: PrismaService,
  ) {}

  private resolveFontPath(): string {
    return path.join(process.cwd(), 'fonts', 'NotoSans-Regular.ttf');
  }

  async buildBuyerCatalogPdf(filters: {
    q?: string;
    assetType?: string;
    status?: string;
    rightsHolderOrgId?: string;
    catalogItemIds?: string[];
  }): Promise<Buffer> {
    const fontFile = this.resolveFontPath();
    if (!fs.existsSync(fontFile)) {
      throw new InternalServerErrorException(
        `Не найден шрифт для PDF: ожидается ${fontFile}`,
      );
    }
    const rows = await this.catalog.findForBuyerCatalog(filters);
    const items = rows as ItemWithRelations[];
    const idList = items.map((i) => i.id);
    const soldRows =
      idList.length === 0
        ? []
        : await this.prisma.dealCatalogItem.findMany({
            where: {
              catalogItemId: { in: idList },
              deal: { stage: { in: CLOSED_DEAL_STAGES } },
            },
            select: { catalogItemId: true },
          });
    const soldSet = new Set(soldRows.map((r) => r.catalogItemId));

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const font = fontFile;
      doc.font(font);

      const pageBottom = () => doc.page.height - 72;
      const needSpace = (minHeight: number) => {
        if (doc.y + minHeight > pageBottom()) {
          doc.addPage();
          doc.font(font);
        }
      };

      doc.fontSize(20).text('Каталог контента для покупателя', {
        align: 'center',
      });
      doc.moveDown(0.5);
      doc
        .fontSize(11)
        .text(`Сформировано: ${new Date().toLocaleString('ru-RU')}`, {
          align: 'center',
        });
      doc.moveDown(1);

      const filterLines: string[] = [];
      if (filters.q?.trim()) {
        filterLines.push(`Поиск: ${filters.q.trim()}`);
      }
      if (filters.assetType?.trim()) {
        filterLines.push(
          `Тип: ${ASSET_RU[filters.assetType] ?? filters.assetType}`,
        );
      }
      if (filters.status?.trim()) {
        filterLines.push(
          `Статус: ${STATUS_RU[filters.status] ?? filters.status}`,
        );
      }
      if (filters.rightsHolderOrgId?.trim()) {
        filterLines.push('Указан фильтр по правообладателю');
      }
      const picked = filters.catalogItemIds?.filter(Boolean) ?? [];
      if (picked.length) {
        filterLines.push(
          `В каталог включены только выбранные тайтлы: ${picked.length} шт. (порядок как в выборе)`,
        );
      }
      if (filterLines.length) {
        doc.fontSize(10).text('Условия выборки в каталоге:');
        for (const l of filterLines) {
          doc.fontSize(9).text(`• ${l}`);
        }
        doc.moveDown(0.8);
      }

      doc
        .fontSize(10)
        .text(
          'Ниже перечислены позиции с полями карточки контента: тип, статус, код, правообладатель, территории и сроки (сводно), платформы, формат лицензии, метаданные и детальные лицензионные условия.',
        );
      doc.moveDown(1.2);

      if (!items.length) {
        doc.fontSize(12).text('По заданным условиям позиции не найдены.');
        doc.end();
        return;
      }

      doc.fontSize(10).text(`Всего позиций: ${items.length}`);
      doc.moveDown(1);

      for (let idx = 0; idx < items.length; idx++) {
        const item = items[idx];
        const terms = item.licenseTerms ?? [];

        needSpace(100);
        doc.fontSize(14).text(`${idx + 1}. ${item.title}`);
        doc.moveDown(0.35);
        doc.fontSize(10);
        doc.text(`Тип контента: ${ASSET_RU[item.assetType] ?? item.assetType}`);
        doc.text(`Статус в каталоге: ${STATUS_RU[item.status] ?? item.status}`);
        doc.text(`Код (slug): ${item.slug}`);
        if (
          item.metadata != null &&
          typeof item.metadata === 'object' &&
          !Array.isArray(item.metadata)
        ) {
          const m = item.metadata as Record<string, unknown>;
          if (typeof m.runtime === 'string' && m.runtime.trim()) {
            doc.text(`Хронометраж: ${m.runtime.trim()}`);
          }
          if (m.episodeCount != null && String(m.episodeCount).trim() !== '') {
            doc.text(`Количество серий: ${m.episodeCount}`);
          }
        }
        doc.text(
          `Правообладатель: ${item.rightsHolder.legalName} (${item.rightsHolder.country})`,
        );
        if (item.rightsHolder.taxId) {
          doc.text(`ИНН / налоговый номер: ${item.rightsHolder.taxId}`);
        }
        doc.text(`Резидент: ${item.rightsHolder.isResident ? 'да' : 'нет'}`);
        doc.text(`Обновлено в каталоге: ${fmtDateRu(item.updatedAt)}`);
        doc.text(`Территории (сводно): ${territoriesLine(terms)}`);
        doc.text(`Сроки (сводно): ${formatDurationRu(terms)}`);
        doc.text(`Платформы (сводно): ${allPlatforms(terms)}`);
        doc.text(
          `Есть исключительные права в условиях: ${hasExclusive(terms) ? 'да' : 'нет'}`,
        );
        doc.text(
          `Справочно: были сделки на стадиях «контракт» / «оплачено»: ${soldSet.has(item.id) ? 'да' : 'нет'}`,
        );

        if (item.metadata != null) {
          needSpace(36);
          doc.moveDown(0.25);
          if (
            typeof item.metadata === 'object' &&
            !Array.isArray(item.metadata)
          ) {
            doc.text('Метаданные (JSON):');
            doc.fontSize(8).text(JSON.stringify(item.metadata, null, 2), {
              width: 500,
              lineGap: 1,
            });
            doc.fontSize(10);
          } else {
            doc.text(`Метаданные: ${JSON.stringify(item.metadata)}`);
          }
        }

        doc.moveDown(0.45);
        needSpace(28);
        doc.fontSize(11).text('Лицензионные условия:');
        if (!terms.length) {
          doc.fontSize(10).text('— не указаны');
        } else {
          for (let tidx = 0; tidx < terms.length; tidx++) {
            const t = terms[tidx];
            needSpace(92);
            doc.fontSize(10).text(`Условие ${tidx + 1}`, { underline: true });
            doc.fontSize(9);
            doc.text(`  Территория: ${t.territoryCode}`);
            doc.text(
              `  Срок: ${formatLicenseTermCell(t.durationMonths, t.startAt, t.endAt)}`,
            );
            doc.text(
              `  Формат лицензии: ${EXCL_RU[t.exclusivity] ?? t.exclusivity}`,
            );
            doc.text(`  Платформы: ${[...t.platforms].join(', ') || '—'}`);
            doc.text(
              `  Сублицензирование: ${t.sublicensingAllowed ? 'разрешено' : 'не разрешено'}`,
            );
            doc.text(
              `  Языковые права: ${
                t.languageRights?.length ? t.languageRights.join(', ') : '—'
              }`,
            );
            doc.fontSize(10);
            doc.moveDown(0.35);
          }
        }

        doc.moveDown(0.5);
        doc
          .fontSize(9)
          .fillColor('#444444')
          .text('Коммерческие условия лицензирования задаются в сделке.');
        doc.fillColor('#000000');
        doc.moveDown(1);
      }

      doc.end();
    });
  }
}
