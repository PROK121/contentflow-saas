/** Подписи типов контента (значения enum API). */
export const ASSET_TYPE_LABELS: Record<string, string> = {
  video: "Фильмы",
  series: "Сериалы",
  animated_series: "Анимационные сериалы",
  animated_film: "Анимационные фильмы",
  anime_series: "Анимэ (сериалы)",
  anime_film: "Анимэ фильмы",
  concert_show: "Концерты/Шоу",
  /** устаревшее значение после миграции БД */
  animation: "Анимационные сериалы",
};

export function formatAssetTypeLabel(raw: string): string {
  const k = raw.toLowerCase();
  return ASSET_TYPE_LABELS[k] ?? raw;
}
