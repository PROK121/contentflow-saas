"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { v1Fetch } from "@/lib/v1-client";
import { formatMoneyAmount, formatMoneyAmountOrEmpty } from "@/lib/format-money";
import { formatAssetTypeLabel } from "@/lib/asset-type-labels";
import { Input } from "@/figma/components/ui/input";
import { Label } from "@/figma/components/ui/label";
import { Button } from "@/figma/components/ui/button";

type CatalogItemOption = {
  id: string;
  title: string;
  assetType: string;
  status: string;
};

type PlatformShare = {
  key: string;
  name: string;
  percent: number;
};

const DEFAULT_SHARES: PlatformShare[] = [
  { key: "kinopoisk", name: "Кинопоиск", percent: 20 },
  { key: "freedom", name: "Фридом", percent: 20 },
  { key: "beetv", name: "БиТВ", percent: 20 },
  { key: "ivi", name: "ИВИ", percent: 20 },
  { key: "tv", name: "ТВ", percent: 5 },
  { key: "ship_rights", name: "Шип права", percent: 5 },
  { key: "tv_plus", name: "ТВ+", percent: 5 },
  { key: "other_regional", name: "Другое (Региональные ТВ)", percent: 5 },
];

function parseAmount(v: string): number {
  const n = Number.parseFloat(v.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function formatThousandsInput(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export function PlatformForecast() {
  const [catalog, setCatalog] = useState<CatalogItemOption[]>([]);
  const [assetType, setAssetType] = useState("");
  const [requestedAmount, setRequestedAmount] = useState("");
  const [shares, setShares] = useState<PlatformShare[]>(DEFAULT_SHARES);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setErr(null);
      try {
        const rows = await v1Fetch<CatalogItemOption[]>("/catalog/items");
        const activeRows = rows.filter((r) => r.status !== "archived");
        setCatalog(activeRows);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Не удалось загрузить контент");
        setCatalog([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const assetTypeOptions = useMemo(
    () =>
      Array.from(
        new Set(
          catalog
            .map((c) => c.assetType?.trim())
            .filter((v): v is string => Boolean(v)),
        ),
      ).sort((a, b) =>
        formatAssetTypeLabel(a).localeCompare(formatAssetTypeLabel(b), "ru"),
      ),
    [catalog],
  );

  const selectedAssetTypeLabel = useMemo(
    () => (assetType ? formatAssetTypeLabel(assetType) : "—"),
    [assetType],
  );

  const gross = useMemo(() => parseAmount(requestedAmount), [requestedAmount]);
  const totalPercent = useMemo(
    () => shares.reduce((acc, row) => acc + row.percent, 0),
    [shares],
  );
  const rows = useMemo(
    () =>
      shares.map((row) => ({
        ...row,
        amount: gross * (row.percent / 100),
      })),
    [shares, gross],
  );
  const totalSaleAmount = useMemo(
    () => rows.reduce((acc, r) => acc + r.amount * 1.4, 0),
    [rows],
  );
  const dealIncome = Math.max(totalSaleAmount - gross, 0);

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap items-start justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-1">
            Прогноз прибыли от площадок
          </h1>
          <p className="text-sm text-muted-foreground">
            Модель распределения запрашиваемой суммы по площадкам с расчетом
            долей и итоговых денег.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => setShares(DEFAULT_SHARES)}
        >
          Сбросить проценты
        </Button>
      </motion.div>

      <section className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Тип контента</Label>
            <select
              className="mt-1 w-full rounded-md border border-border/50 bg-input-background px-3 py-2 text-sm"
              value={assetType}
              onChange={(e) => setAssetType(e.target.value)}
            >
              <option value="">Выберите тип контента…</option>
              {assetTypeOptions.map((type) => (
                <option key={type} value={type}>
                  {formatAssetTypeLabel(type)}
                </option>
              ))}
            </select>
            {loading ? (
              <p className="text-xs text-muted-foreground mt-1">Загрузка…</p>
            ) : null}
          </div>
          <div>
            <Label>Запрошиваемая сумма от правообладателя (KZT)</Label>
            <Input
              className="mt-1 font-mono"
              placeholder="Например: 12 000 000"
              value={requestedAmount}
              onChange={(e) => setRequestedAmount(formatThousandsInput(e.target.value))}
              onBlur={() =>
                setRequestedAmount((prev) => formatMoneyAmountOrEmpty(prev))
              }
            />
          </div>
        </div>
        {err ? (
          <p className="text-sm text-destructive whitespace-pre-wrap">{err}</p>
        ) : null}
      </section>

      <section className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h2 className="text-lg font-semibold">Доли площадок</h2>
        <div className="hidden md:grid md:grid-cols-[1fr_140px_180px_220px] gap-2 px-3 text-xs text-muted-foreground font-semibold">
          <p>Площадка</p>
          <p>Процент</p>
          <p className="text-right">Сумма для ПО</p>
          <p className="text-right">Минимальный порог продажи (40%)</p>
        </div>
        <div className="space-y-2">
          {shares.map((row, idx) => (
            <div
              key={row.key}
              className="grid grid-cols-1 md:grid-cols-[1fr_140px_180px_220px] gap-2 items-center rounded border border-border/70 px-3 py-2"
            >
              <p className="text-sm font-medium">{row.name}</p>
              <Input
                value={String(row.percent)}
                onChange={(e) => {
                  const raw = Number.parseFloat(
                    e.target.value.replace(",", "."),
                  );
                  const next = Number.isFinite(raw) ? Math.max(raw, 0) : 0;
                  setShares((prev) =>
                    prev.map((p, i) => (i === idx ? { ...p, percent: next } : p)),
                  );
                }}
              />
              <p className="text-sm font-mono text-right">
                {formatMoneyAmount(rows[idx]?.amount ?? 0)} KZT
              </p>
              <p className="text-sm font-mono text-right">
                {formatMoneyAmount((rows[idx]?.amount ?? 0) * 1.4)} KZT
              </p>
            </div>
          ))}
        </div>
        <div className="pt-2 border-t border-border space-y-1 text-sm">
          <p>
            Сумма процентов:{" "}
            <span className="font-semibold">{formatMoneyAmount(totalPercent)}%</span>
          </p>
          {Math.abs(totalPercent - 100) > 0.001 ? (
            <p className="text-amber-700 dark:text-amber-300">
              Проценты не равны 100% — добавьте/уменьшите доли, чтобы модель
              сходилась.
            </p>
          ) : null}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5 space-y-2">
        <h2 className="text-lg font-semibold">Результат по деньгам</h2>
        <p className="text-sm text-muted-foreground">
          Тип контента:{" "}
          <span className="font-medium text-foreground">{selectedAssetTypeLabel}</span>
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded border border-border p-3">
            <p className="text-xs text-muted-foreground">Запрашиваемая сумма</p>
            <p className="text-lg font-bold">{formatMoneyAmount(gross)} KZT</p>
          </div>
          <div className="rounded border border-border p-3">
            <p className="text-xs text-muted-foreground">Сумма продажи</p>
            <p className="text-lg font-bold">{formatMoneyAmount(totalSaleAmount)} KZT</p>
          </div>
          <div className="rounded border border-border p-3">
            <p className="text-xs text-muted-foreground">Доход со сделки</p>
            <p className="text-lg font-bold">{formatMoneyAmount(dealIncome)} KZT</p>
          </div>
        </div>
      </section>
    </div>
  );
}
