"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { v1Fetch } from "@/lib/v1-client";
import { formatMoneyAmount } from "@/lib/format-money";
import { Input } from "@/figma/components/ui/input";
import { Label } from "@/figma/components/ui/label";
import { formatAssetTypeLabel } from "@/lib/asset-type-labels";
import {
  isSeriesLikeCatalogAssetType,
  readCatalogOfferSourceMeta,
} from "@/lib/catalog-item-create";

type CatalogItemOption = {
  id: string;
  title: string;
  assetType: string;
  status: string;
  metadata?: unknown;
  licenseTerms?: { exclusivity: string }[];
};

type MoneyRange = { min: number; max: number };
const MANUAL_CONTENT_ID = "__manual__";

const MOVIE_LIBRARY_ROWS: {
  minYear: number;
  maxYear: number;
  range: MoneyRange;
}[] = [
  { minYear: 1900, maxYear: 2015, range: { min: 330000, max: 350000 } },
  { minYear: 2016, maxYear: 2019, range: { min: 380000, max: 420000 } },
  { minYear: 2020, maxYear: 2022, range: { min: 480000, max: 550000 } },
  { minYear: 2023, maxYear: 2024, range: { min: 550000, max: 650000 } },
  { minYear: 2025, maxYear: 2100, range: { min: 800000, max: 1200000 } },
];

const MOVIE_PREMIERE_CATEGORY: Record<"A" | "B" | "C", MoneyRange> = {
  A: { min: 8000000, max: 12000000 },
  B: { min: 4000000, max: 6000000 },
  C: { min: 0, max: 4000000 },
};

const SERIES_PREMIERE_ROWS: Record<
  "non_exclusive" | "co_exclusive" | "exclusive",
  { minYear: number; maxYear: number; range: MoneyRange }[]
> = {
  non_exclusive: [
    { minYear: 2020, maxYear: 2022, range: { min: 150000, max: 200000 } },
    { minYear: 2023, maxYear: 2024, range: { min: 200000, max: 400000 } },
    { minYear: 2025, maxYear: 2026, range: { min: 400000, max: 600000 } },
  ],
  co_exclusive: [{ minYear: 2025, maxYear: 2026, range: { min: 800000, max: 1700000 } }],
  exclusive: [{ minYear: 2025, maxYear: 2026, range: { min: 1000000, max: 2000000 } }],
};

function findByYear<T extends { minYear: number; maxYear: number }>(
  year: number,
  rows: T[],
): T | null {
  return rows.find((r) => year >= r.minYear && year <= r.maxYear) ?? null;
}

function fmtRange(r: MoneyRange, suffix = ""): string {
  return `${formatMoneyAmount(r.min)} - ${formatMoneyAmount(r.max)}${suffix}`;
}

function formatThousandsInput(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function exclusivityRu(v: "non_exclusive" | "co_exclusive" | "exclusive"): string {
  if (v === "exclusive") return "Эксклюзив";
  if (v === "co_exclusive") return "Ко-эксклюзив";
  return "Не эксклюзив";
}

export function GradesPricing() {
  const [catalog, setCatalog] = useState<CatalogItemOption[]>([]);
  const [catalogId, setCatalogId] = useState("");
  const [year, setYear] = useState("");
  const [requestedAmount, setRequestedAmount] = useState("");
  const [episodes, setEpisodes] = useState("");
  const [model, setModel] = useState<"library" | "premiere">("library");
  const [moviePremiereCategory, setMoviePremiereCategory] = useState<"A" | "B" | "C">("B");
  const [manualAssetKind, setManualAssetKind] = useState<"movie" | "series">("movie");
  const [manualExclusivity, setManualExclusivity] = useState<
    "non_exclusive" | "co_exclusive" | "exclusive"
  >("non_exclusive");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const rows = await v1Fetch<CatalogItemOption[]>("/catalog/items");
        setCatalog(rows.filter((r) => r.status !== "archived"));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const selected = useMemo(
    () => (catalogId === MANUAL_CONTENT_ID ? null : catalog.find((c) => c.id === catalogId) ?? null),
    [catalog, catalogId],
  );
  const isManualMode = catalogId === MANUAL_CONTENT_ID;
  const seriesExclusivityFromCard = useMemo(() => {
    const vals =
      selected?.licenseTerms
        ?.map((t) => String(t.exclusivity || "").trim())
        .filter(Boolean) ?? [];
    if (vals.includes("exclusive")) return "exclusive" as const;
    if (vals.includes("co_exclusive")) return "co_exclusive" as const;
    return "non_exclusive" as const;
  }, [selected?.licenseTerms]);
  const isSeries = useMemo(
    () => isSeriesLikeCatalogAssetType(selected?.assetType ?? ""),
    [selected?.assetType],
  );
  const effectiveIsSeries = isManualMode ? manualAssetKind === "series" : isSeries;
  const effectiveExclusivity = isManualMode ? manualExclusivity : seriesExclusivityFromCard;
  const itemMeta = useMemo(
    () => readCatalogOfferSourceMeta(selected?.metadata),
    [selected?.metadata],
  );

  useEffect(() => {
    if (isManualMode) return;
    if (!selected) return;
    setYear(itemMeta.productionYear?.trim() ?? "");
    if (itemMeta.episodeCount != null) {
      setEpisodes(String(itemMeta.episodeCount));
    } else if (!isSeriesLikeCatalogAssetType(selected.assetType)) {
      setEpisodes("");
    }
  }, [isManualMode, selected, itemMeta.productionYear, itemMeta.episodeCount]);

  const yearNum = useMemo(() => Number.parseInt(year.trim(), 10), [year]);
  const episodesNum = useMemo(() => Number.parseInt(episodes.trim(), 10), [episodes]);
  const requested = useMemo(() => {
    const n = Number.parseFloat(requestedAmount.replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }, [requestedAmount]);

  const variants = useMemo(() => {
    if ((!selected && !isManualMode) || !Number.isFinite(yearNum)) return [];
    const out: { label: string; min: number; max: number; note?: string }[] = [];

    if (!effectiveIsSeries) {
      if (model === "library") {
        const row = findByYear(yearNum, MOVIE_LIBRARY_ROWS);
        if (!row) return [];
        out.push({
          label: "Фильм · библиотека",
          min: row.range.min,
          max: row.range.max,
          note: "Производство: Казахстан (GRWX)",
        });
      } else {
        const r = MOVIE_PREMIERE_CATEGORY[moviePremiereCategory];
        out.push({
          label: `Фильм · премьера · категория ${moviePremiereCategory}`,
          min: r.min,
          max: r.max,
          note: "Категория из прайса GRWX: A/B/C",
        });
      }
      return out;
    }

    if (!Number.isFinite(episodesNum) || episodesNum <= 0) {
      return [];
    }

    const row = findByYear(yearNum, SERIES_PREMIERE_ROWS[effectiveExclusivity]);
    if (!row) return [];
    out.push({
      label: `Сериал · ${episodesNum} эп.`,
      min: row.range.min * episodesNum,
      max: row.range.max * episodesNum,
      note: isManualMode
        ? `Тип лицензии: ${exclusivityRu(effectiveExclusivity)} · за эпизод: ${fmtRange(row.range)}`
        : `Тип лицензии из карточки: ${exclusivityRu(effectiveExclusivity)} · за эпизод: ${fmtRange(row.range)}`,
    });
    return out;
  }, [
    selected,
    isManualMode,
    yearNum,
    episodesNum,
    effectiveIsSeries,
    model,
    moviePremiereCategory,
    effectiveExclusivity,
  ]);

  const requestedHint = useMemo(
    () =>
      variants.map((v) => {
        const inRange = requested >= v.min && requested <= v.max;
        const deltaToMin = requested > 0 ? requested - v.min : 0;
        return { ...v, inRange, deltaToMin };
      }),
    [variants, requested],
  );

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-foreground">Грейды</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Подбор вариантов стоимости по таблице грейдов GRWX.
        </p>
      </motion.div>

      <section className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Контент</Label>
            <select
              className="mt-1 w-full rounded-md border border-border/50 bg-input-background px-3 py-2 text-sm"
              value={catalogId}
              onChange={(e) => setCatalogId(e.target.value)}
            >
              <option value="">Выберите тайтл…</option>
              <option value={MANUAL_CONTENT_ID}>Ручной ввод</option>
              {catalog.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title} · {formatAssetTypeLabel(c.assetType)}
                </option>
              ))}
            </select>
            {loading ? <p className="text-xs text-muted-foreground mt-1">Загрузка…</p> : null}
          </div>
          {isManualMode ? (
            <div>
              <Label>Тип контента</Label>
              <select
                className="mt-1 w-full rounded-md border border-border/50 bg-input-background px-3 py-2 text-sm"
                value={manualAssetKind}
                onChange={(e) => setManualAssetKind(e.target.value as "movie" | "series")}
              >
                <option value="movie">Фильм</option>
                <option value="series">Сериал</option>
              </select>
            </div>
          ) : null}
          <div>
            <Label>Год производства</Label>
            <Input value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, ""))} />
          </div>
          <div>
            <Label>Тип лицензии (из карточки контента)</Label>
            {isManualMode ? (
              <select
                className="mt-1 w-full rounded-md border border-border/50 bg-input-background px-3 py-2 text-sm"
                value={manualExclusivity}
                onChange={(e) =>
                  setManualExclusivity(
                    e.target.value as "non_exclusive" | "co_exclusive" | "exclusive",
                  )
                }
              >
                <option value="non_exclusive">Не эксклюзив</option>
                <option value="co_exclusive">Ко-эксклюзив</option>
                <option value="exclusive">Эксклюзив</option>
              </select>
            ) : (
              <Input
                value={selected ? exclusivityRu(seriesExclusivityFromCard) : ""}
                readOnly
                className="mt-1"
                placeholder="Подтягивается автоматически"
              />
            )}
          </div>
          <div>
            <Label>Модель</Label>
            <select
              className="mt-1 w-full rounded-md border border-border/50 bg-input-background px-3 py-2 text-sm"
              value={model}
              onChange={(e) => setModel(e.target.value as "library" | "premiere")}
            >
              <option value="library">Не эксклюзив / библиотека</option>
              <option value="premiere">Премьеры</option>
            </select>
          </div>
          <div>
            <Label>Запрашиваемая сумма (KZT)</Label>
            <Input
              value={requestedAmount}
              onChange={(e) => setRequestedAmount(formatThousandsInput(e.target.value))}
              placeholder="Например: 5 000 000"
            />
          </div>
        </div>

        {effectiveIsSeries ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Количество эпизодов</Label>
              <Input
                value={episodes}
                onChange={(e) => setEpisodes(e.target.value.replace(/\D/g, ""))}
              />
            </div>
          </div>
        ) : model === "premiere" ? (
          <div className="max-w-md">
            <Label>Категория фильма (премьера)</Label>
            <select
              className="mt-1 w-full rounded-md border border-border/50 bg-input-background px-3 py-2 text-sm"
              value={moviePremiereCategory}
              onChange={(e) => setMoviePremiereCategory(e.target.value as "A" | "B" | "C")}
            >
              <option value="A">A (High)</option>
              <option value="B">B (Medium)</option>
              <option value="C">C (Low)</option>
            </select>
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h2 className="text-lg font-semibold">Варианты стоимости</h2>
        {requestedHint.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Заполните поля выше (контент, год и параметры модели), чтобы получить
            варианты стоимости.
          </p>
        ) : (
          <div className="space-y-2">
            {requestedHint.map((v) => (
              <div key={v.label} className="rounded-md border border-border p-3">
                <p className="font-semibold text-sm">{v.label}</p>
                <p className="text-sm mt-1">
                  Диапазон:{" "}
                  <span className="font-mono">
                    {fmtRange({ min: v.min, max: v.max })} KZT
                  </span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Рекомендованный ориентир (середина):{" "}
                  {formatMoneyAmount((v.min + v.max) / 2)} KZT
                </p>
                {requested > 0 ? (
                  <p
                    className={`text-xs mt-1 ${v.inRange ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300"}`}
                  >
                    {v.inRange
                      ? "Запрашиваемая сумма попадает в грейд."
                      : `Запрашиваемая сумма вне грейда (разница с нижней границей: ${formatMoneyAmount(v.deltaToMin)} KZT).`}
                  </p>
                ) : null}
                {v.note ? (
                  <p className="text-xs text-muted-foreground mt-1">{v.note}</p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card p-5 space-y-2">
        <h2 className="text-lg font-semibold">Допущения модели</h2>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
          <li>Грейды взяты из файла «Грейды по ценам кино, сериалы GRWX».</li>
          <li>Для сериалов расчет делается за эпизод и умножается на число эпизодов.</li>
          <li>Если по выбранному году/формату нет строки в прайсе, вариант не выводится.</li>
        </ul>
      </section>
    </div>
  );
}
