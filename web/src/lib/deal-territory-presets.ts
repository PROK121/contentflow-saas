/** Территории для выбора прав в сделке (код → подпись в UI). */
export const DEAL_TERRITORY_PRESETS = [
  { code: "CIS", label: "СНГ" },
  { code: "WW", label: "Весь мир" },
  { code: "KZ", label: "КЗ" },
  { code: "CIS_EX_KZ", label: "СНГ без КЗ" },
  { code: "CIS_EX_RU", label: "СНГ без РФ" },
  { code: "CIS_EX_KG", label: "СНГ без Крг" },
] as const;

const LABEL_BY_CODE: Map<string, string> = new Map(
  DEAL_TERRITORY_PRESETS.map((p) => [p.code, p.label]),
);

export function dealTerritoryLabel(code: string): string {
  const u = code.toUpperCase();
  return LABEL_BY_CODE.get(u) ?? code;
}

export function formatDealTerritoryCodes(codes: string[]): string {
  return codes.map(dealTerritoryLabel).join(", ");
}
