"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/figma/components/ui/accordion";
import { Button } from "@/figma/components/ui/button";
import { Checkbox } from "@/figma/components/ui/checkbox";
import { Input } from "@/figma/components/ui/input";
import { Label } from "@/figma/components/ui/label";
import { v1Fetch } from "@/lib/v1-client";
import { cn } from "@/figma/components/ui/utils";
import {
  DEAL_TERRITORY_PRESETS,
  formatDealTerritoryCodes,
} from "@/lib/deal-territory-presets";
import {
  CATALOG_EXCLUSIVITY,
  CATALOG_PLATFORM_OPTIONS,
  formatExclusivityLabel,
  formatPlatformLabel,
  LEGACY_PLATFORM_VALUES,
} from "@/lib/catalog-item-create";
import { formatDateRangeYearsHint } from "@/lib/license-term-format";

const PLATFORM_VALUES_UI = CATALOG_PLATFORM_OPTIONS.map((o) => o.value);
const ALL_KNOWN_PLATFORMS = [
  ...PLATFORM_VALUES_UI,
  ...LEGACY_PLATFORM_VALUES,
] as const;

type Exclusivity = "exclusive" | "co_exclusive" | "non_exclusive";

type RightsForm = {
  territoryCodes: string[];
  startAt: string;
  endAt: string;
  platforms: string[];
  exclusivity: Exclusivity;
};

type ValidateResult = {
  licenseGaps: string[];
  blockingConflicts: { territory: string; reason: string; dealId: string }[];
  partialOverlaps: { territory: string; dealId: string }[];
  canContinue: boolean;
};

function defaultForm(): RightsForm {
  return {
    territoryCodes: ["KZ"],
    startAt: "",
    endAt: "",
    platforms: ["TV"],
    exclusivity: "non_exclusive",
  };
}

function formFromRaw(
  _catalogItemId: string,
  raw: unknown,
): RightsForm {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return defaultForm();
  }
  const o = raw as Record<string, unknown>;
  const territoryCodes = Array.isArray(o.territoryCodes)
    ? (o.territoryCodes as unknown[]).map((t) => String(t).toUpperCase())
    : ["KZ"];
  const platforms = Array.isArray(o.platforms)
    ? (o.platforms as string[]).filter((p) =>
        (ALL_KNOWN_PLATFORMS as readonly string[]).includes(p),
      )
    : ["TV"];
  const exRaw = o.exclusivity;
  const exNormalized =
    exRaw === "sole" ? "exclusive" : exRaw;
  const exclusivity =
    exNormalized === "exclusive" || exNormalized === "non_exclusive"
      ? exNormalized
      : "non_exclusive";
  const startAt =
    typeof o.startAt === "string"
      ? o.startAt.slice(0, 10)
      : "";
  const endAt =
    typeof o.endAt === "string" ? o.endAt.slice(0, 10) : "";
  return {
    territoryCodes: territoryCodes.length ? territoryCodes : ["KZ"],
    startAt,
    endAt,
    platforms: platforms.length ? platforms : ["TV"],
    exclusivity,
  };
}

function formToSelection(catalogItemId: string, f: RightsForm) {
  return {
    catalogItemId,
    territoryCodes: f.territoryCodes,
    startAt: f.startAt || undefined,
    endAt: f.endAt || undefined,
    platforms: f.platforms,
    exclusivity: f.exclusivity,
  };
}

type LicenseTerm = { territoryCode: string };

export function DealCatalogRightsCard(props: {
  dealId: string;
  catalogItemId: string;
  title: string;
  rightsSelection: unknown;
  licenseTerms: LicenseTerm[];
  onUpdated: () => void;
}) {
  const { dealId, catalogItemId, title, rightsSelection, licenseTerms, onUpdated } =
    props;
  const [form, setForm] = useState<RightsForm>(() =>
    formFromRaw(catalogItemId, rightsSelection),
  );
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [validate, setValidate] = useState<ValidateResult | null>(null);
  const [adminOverride, setAdminOverride] = useState(false);

  useEffect(() => {
    setForm(formFromRaw(catalogItemId, rightsSelection));
  }, [catalogItemId, rightsSelection]);

  const runValidate = useCallback(async () => {
    const sel = formToSelection(catalogItemId, form);
    try {
      const v = await v1Fetch<ValidateResult>("/deals/rights/validate", {
        method: "POST",
        body: JSON.stringify({
          catalogItemId,
          excludeDealId: dealId,
          adminOverride,
          selection: sel,
        }),
      });
      setValidate(v);
    } catch {
      setValidate(null);
    }
  }, [dealId, catalogItemId, form, adminOverride]);

  useEffect(() => {
    const t = setTimeout(() => void runValidate(), 400);
    return () => clearTimeout(t);
  }, [runValidate]);

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      await v1Fetch(`/deals/${dealId}`, {
        method: "PATCH",
        body: JSON.stringify({
          rightsSelections: [formToSelection(catalogItemId, form)],
        }),
      });
      setEditing(false);
      onUpdated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Не сохранилось");
    } finally {
      setBusy(false);
    }
  }

  const licensedHint =
    licenseTerms.length > 0
      ? licenseTerms.map((l) => l.territoryCode).join(", ")
      : "—";

  const periodYearsHint = formatDateRangeYearsHint(form.startAt, form.endAt);

  return (
    <AccordionItem value={catalogItemId}>
      <AccordionTrigger className="text-left hover:no-underline py-3">
        <span className="text-base font-semibold text-foreground leading-snug">
          {title}
        </span>
      </AccordionTrigger>
      <AccordionContent className="space-y-4">
        {err && (
          <p className="text-sm text-destructive whitespace-pre-wrap">{err}</p>
        )}

        {!editing ? (
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm space-y-2">
            <div className="grid sm:grid-cols-2 gap-2">
              <div>
                <p className="text-xs text-muted-foreground">Территории</p>
                <p className="font-medium">
                  {form.territoryCodes.length
                    ? formatDealTerritoryCodes(form.territoryCodes)
                    : "не заданы"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Лицензия (каталог)</p>
                <p className="font-medium">{licensedHint}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Период</p>
                <div>
                  <p className="font-medium">
                    {form.startAt || "—"} — {form.endAt || "—"}
                  </p>
                  {periodYearsHint ? (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {periodYearsHint}
                    </p>
                  ) : null}
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Формат лицензии</p>
                <p className="font-medium">
                  {formatExclusivityLabel(form.exclusivity)}
                </p>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Платформы</p>
              <div className="flex flex-wrap gap-1">
                {form.platforms.map((p) => (
                  <span
                    key={p}
                    className="px-2 py-0.5 rounded bg-background border text-xs"
                  >
                    {formatPlatformLabel(p)}
                  </span>
                ))}
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setEditing(true)}
            >
              Изменить права
            </Button>
          </div>
        ) : (
          <div className="rounded-lg border border-border p-3 space-y-3">
            <div>
              <Label className="text-xs">Территории</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {DEAL_TERRITORY_PRESETS.map((t) => (
                  <label key={t.code} className="flex items-center gap-1 text-xs">
                    <Checkbox
                      checked={form.territoryCodes.includes(t.code)}
                      onCheckedChange={() => {
                        setForm((f) => {
                          const s = new Set(f.territoryCodes);
                          if (s.has(t.code)) s.delete(t.code);
                          else s.add(t.code);
                          return {
                            ...f,
                            territoryCodes: [...s],
                          };
                        });
                      }}
                    />
                    {t.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Начало</Label>
                  <Input
                    type="date"
                    value={form.startAt}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, startAt: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs">Окончание</Label>
                  <Input
                    type="date"
                    value={form.endAt}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, endAt: e.target.value }))
                    }
                  />
                </div>
              </div>
              {periodYearsHint ? (
                <p className="text-xs text-muted-foreground">
                  {periodYearsHint}
                </p>
              ) : null}
            </div>
            <div>
              <Label className="text-xs">Платформы</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {CATALOG_PLATFORM_OPTIONS.map(({ value, label }) => (
                  <label
                    key={value}
                    className="flex items-center gap-1 text-xs"
                  >
                    <Checkbox
                      checked={form.platforms.includes(value)}
                      onCheckedChange={() => {
                        setForm((f) => {
                          const s = new Set(f.platforms);
                          if (s.has(value)) s.delete(value);
                          else s.add(value);
                          return { ...f, platforms: [...s] };
                        });
                      }}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs">Формат лицензии</Label>
              <select
                className="mt-1 w-full rounded-md border border-border/50 bg-input-background px-2 py-2 text-sm"
                value={form.exclusivity}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    exclusivity: e.target.value as Exclusivity,
                  }))
                }
              >
                {CATALOG_EXCLUSIVITY.map((x) => (
                  <option key={x.value} value={x.value}>
                    {x.label}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 text-xs">
              <Checkbox
                checked={adminOverride}
                onCheckedChange={(v) => setAdminOverride(v === true)}
              />
              Admin override конфликтов (demo)
            </label>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                disabled={busy || (!adminOverride && validate?.canContinue === false)}
                onClick={() => void save()}
              >
                Сохранить
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditing(false);
                  setForm(formFromRaw(catalogItemId, rightsSelection));
                }}
              >
                Отмена
              </Button>
            </div>
          </div>
        )}

        {validate && (
          <div
            className={cn(
              "text-xs rounded-md p-3 space-y-1 border",
              validate.canContinue
                ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800"
                : "bg-destructive/5 border-destructive/20",
            )}
          >
            <p className="font-semibold">Проверка относительно рынка</p>
            {validate.licenseGaps.length > 0 && (
              <p className="text-destructive">
                Нет лицензии на: {validate.licenseGaps.join(", ")} → недоступно
              </p>
            )}
            {validate.blockingConflicts.length > 0 && (
              <p className="text-destructive">
                Конфликт:{" "}
                {validate.blockingConflicts.map((c) => c.territory).join(", ")}
              </p>
            )}
            {validate.partialOverlaps.length > 0 && (
              <p className="text-amber-700 dark:text-amber-400">
                Частичное пересечение:{" "}
                {validate.partialOverlaps.map((p) => p.territory).join(", ")}
              </p>
            )}
            <p className={validate.canContinue ? "text-emerald-800 dark:text-emerald-200" : ""}>
              {validate.canContinue
                ? "Можно использовать выбранные параметры (в рамках проверки)."
                : "Есть блокирующие ограничения — измените права или включите override."}
            </p>
          </div>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}
