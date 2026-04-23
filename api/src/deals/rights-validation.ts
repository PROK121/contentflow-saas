import { DealStage, Exclusivity, Platform, Prisma } from '@prisma/client';

/** Территории, входящие в условное «CIS» для проверки лицензии. */
const CIS = new Set([
  'KZ',
  'RU',
  'BY',
  'KG',
  'AM',
  'AZ',
  'TJ',
  'UZ',
  'TM',
  'MD',
]);

type ExpandedTerritory = Set<string> | 'WW';

function expandTerritoryCode(t: string): ExpandedTerritory {
  const u = t.toUpperCase();
  if (u === 'WW' || u === 'WORLD') return 'WW';
  if (u === 'CIS') return new Set(CIS);
  if (u === 'CIS_EX_KZ') {
    const s = new Set(CIS);
    s.delete('KZ');
    return s;
  }
  if (u === 'CIS_EX_RU') {
    const s = new Set(CIS);
    s.delete('RU');
    return s;
  }
  if (u === 'CIS_EX_KG') {
    const s = new Set(CIS);
    s.delete('KG');
    return s;
  }
  if (CIS.has(u)) return new Set([u]);
  return new Set([u]);
}

/** Права по лицензии (lic) покрывают выбранную в сделке территорию (sel). */
function selectionCoveredByLicense(
  sel: ExpandedTerritory,
  lic: ExpandedTerritory,
): boolean {
  if (sel === 'WW') return lic === 'WW';
  if (lic === 'WW') return true;
  for (const x of sel) {
    if (!lic.has(x)) return false;
  }
  return true;
}

export function territoryCoveredByLicenseTerm(
  code: string,
  licenseTerritory: string,
): boolean {
  return selectionCoveredByLicense(
    expandTerritoryCode(code),
    expandTerritoryCode(licenseTerritory),
  );
}

export type ParsedRightsSelection = {
  territoryCodes: string[];
  startAt: Date | null;
  endAt: Date | null;
  platforms: Platform[];
  exclusivity: Exclusivity;
};

export function parseRightsSelection(
  raw: Prisma.JsonValue | Prisma.InputJsonValue | null | undefined,
): ParsedRightsSelection | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.territoryCodes)) return null;
  const territoryCodes = o.territoryCodes.map((t) => String(t).toUpperCase());
  const exclusivity = o.exclusivity as Exclusivity;
  if (!Object.values(Exclusivity).includes(exclusivity)) return null;
  const platforms = Array.isArray(o.platforms)
    ? (o.platforms as Platform[]).filter((p) =>
        Object.values(Platform).includes(p),
      )
    : [];
  const startAt =
    typeof o.startAt === 'string'
      ? new Date(o.startAt)
      : o.startAt instanceof Date
        ? o.startAt
        : null;
  const endAt =
    typeof o.endAt === 'string'
      ? new Date(o.endAt)
      : o.endAt instanceof Date
        ? o.endAt
        : null;
  return { territoryCodes, startAt, endAt, platforms, exclusivity };
}

export function territoriesOverlap(a: string[], b: string[]): string[] {
  const setB = new Set(b.map((x) => x.toUpperCase()));
  return [...new Set(a.map((x) => x.toUpperCase()))].filter((x) => setB.has(x));
}

function isExclusive(e: Exclusivity): boolean {
  return e === Exclusivity.exclusive || e === Exclusivity.sole;
}

/** Блокирующий конфликт: пересечение территорий и «сильная» эксклюзивность у любой стороны. */
export function isBlockingRightsConflict(
  existing: ParsedRightsSelection,
  proposed: ParsedRightsSelection,
): boolean {
  const overlap = territoriesOverlap(
    existing.territoryCodes,
    proposed.territoryCodes,
  );
  if (overlap.length === 0) return false;
  return isExclusive(existing.exclusivity) || isExclusive(proposed.exclusivity);
}

export const CLOSED_DEAL_STAGES: DealStage[] = [
  DealStage.contract,
  DealStage.paid,
];
