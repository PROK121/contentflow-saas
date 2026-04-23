"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/figma/components/ui/dialog";
import { Button } from "@/figma/components/ui/button";
import { Input } from "@/figma/components/ui/input";
import { Label } from "@/figma/components/ui/label";
import { Checkbox } from "@/figma/components/ui/checkbox";
import { v1Fetch } from "@/lib/v1-client";
import { NewCatalogItemForm } from "@/components/content/NewCatalogItemForm";
import {
  formatMoneyAmountOrEmpty,
  normalizeMoneyInput,
} from "@/lib/format-money";
import { cn } from "@/figma/components/ui/utils";
import { DEAL_TERRITORY_PRESETS } from "@/lib/deal-territory-presets";
import {
  CATALOG_EXCLUSIVITY,
  CATALOG_PLATFORM_OPTIONS,
} from "@/lib/catalog-item-create";
import { formatDateRangeYearsHint } from "@/lib/license-term-format";

type Org = {
  id: string;
  legalName: string;
  country: string;
  type: string;
};

type LicenseTerm = { territoryCode: string };

type CatalogItem = {
  id: string;
  title: string;
  slug: string;
  licenseTerms: LicenseTerm[];
};

type Manager = {
  id: string;
  email: string;
  role: string;
  displayName?: string | null;
};

const TERRITORY_PRESETS = ["KZ", "RU", "CIS", "WW", "EU", "US"] as const;

type Exclusivity = "exclusive" | "co_exclusive" | "non_exclusive";

type RightsForm = {
  territoryCodes: string[];
  startAt: string;
  endAt: string;
  platforms: string[];
  exclusivity: Exclusivity;
};

const defaultRights = (): RightsForm => ({
  territoryCodes: ["KZ"],
  startAt: "",
  endAt: "",
  platforms: ["TV"],
  exclusivity: "non_exclusive",
});

type ValidateResult = {
  licenseGaps: string[];
  blockingConflicts: { territory: string; reason: string; dealId: string }[];
  partialOverlaps: { territory: string; dealId: string }[];
  canContinue: boolean;
};

export type WizardSeed = {
  buyerOrgId?: string;
  catalogItemIds?: string[];
};

export function CreateDealWizard(props: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (dealId: string) => void;
  /** Предзаполнение из URL (?catalogItemId= / ?buyerOrgId=) или каталога */
  wizardSeed?: WizardSeed | null;
}) {
  const { open, onOpenChange, onCreated, wizardSeed } = props;
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [clientOrgs, setClientOrgs] = useState<Org[]>([]);
  const [rightsHolderOrgs, setRightsHolderOrgs] = useState<Org[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);

  const [dealKind, setDealKind] = useState<"sale" | "purchase">("sale");
  const [clientQuery, setClientQuery] = useState("");
  const [buyerOrgId, setBuyerOrgId] = useState("");
  const [inlineClientOpen, setInlineClientOpen] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientCountry, setNewClientCountry] = useState("KZ");

  /** Только пользовательская часть; префикс ПРОДАЖА/ПОКУПКА добавляется при сохранении. */
  const [titleSuffix, setTitleSuffix] = useState("");
  const [catalogIds, setCatalogIds] = useState<string[]>([]);
  const [expectedValue, setExpectedValue] = useState("");
  const [vatIncluded, setVatIncluded] = useState(true);
  const [ownerUserId, setOwnerUserId] = useState("");

  const [soldHintIds, setSoldHintIds] = useState<string[]>([]);
  const [rightsByItem, setRightsByItem] = useState<Record<string, RightsForm>>(
    {},
  );
  const [validateByItem, setValidateByItem] = useState<
    Record<string, ValidateResult | null>
  >({});
  const [adminOverride, setAdminOverride] = useState(false);

  const [newCatalogOpen, setNewCatalogOpen] = useState(false);
  const [newCatalogFormKey, setNewCatalogFormKey] = useState(0);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setErr(null);
    setInlineClientOpen(false);
    setSoldHintIds([]);
    setValidateByItem({});
    setAdminOverride(false);
    setDealKind("sale");
    setNewCatalogOpen(false);
    if (!wizardSeed) {
      setBuyerOrgId("");
      setCatalogIds([]);
      setTitleSuffix("");
      setExpectedValue("");
      setVatIncluded(true);
      setClientQuery("");
      setOwnerUserId("");
    } else {
      if (wizardSeed.buyerOrgId) setBuyerOrgId(wizardSeed.buyerOrgId);
      if (wizardSeed.catalogItemIds?.length) {
        setCatalogIds([...wizardSeed.catalogItemIds]);
      }
    }
  }, [open, wizardSeed]);

  useEffect(() => {
    if (!open) return;
    void (async () => {
      const [cl, rh, c, m] = await Promise.all([
        v1Fetch<Org[]>("/organizations?type=client"),
        v1Fetch<Org[]>("/organizations?type=rights_holder"),
        v1Fetch<CatalogItem[]>("/catalog/items"),
        v1Fetch<Manager[]>("/users/managers"),
      ]);
      setClientOrgs(cl);
      setRightsHolderOrgs(rh);
      setCatalog(c);
      setManagers(m);
      setOwnerUserId((prev) => (prev ? prev : m[0]?.id ?? ""));
    })();
  }, [open]);

  const counterpartyOrgs =
    dealKind === "sale" ? clientOrgs : rightsHolderOrgs;
  const selectedCounterparty = counterpartyOrgs.find((c) => c.id === buyerOrgId);
  const isPurchaseNonKzCounterparty =
    dealKind === "purchase" &&
    (selectedCounterparty?.country ?? "").trim().toUpperCase() !== "KZ";

  const filteredCounterparties = useMemo(() => {
    const q = clientQuery.trim().toLowerCase();
    if (!q) return counterpartyOrgs;
    return counterpartyOrgs.filter(
      (c) =>
        c.legalName.toLowerCase().includes(q) ||
        c.country.toLowerCase().includes(q),
    );
  }, [counterpartyOrgs, clientQuery]);

  const refreshSoldHints = useCallback(async (ids: string[]) => {
    if (!ids.length) {
      setSoldHintIds([]);
      return;
    }
    const r = await v1Fetch<{ catalogItemIdsWithSales: string[] }>(
      "/deals/sold-hints",
      { method: "POST", body: JSON.stringify({ catalogItemIds: ids }) },
    );
    setSoldHintIds(r.catalogItemIdsWithSales);
  }, []);

  useEffect(() => {
    if (!open) return;
    void refreshSoldHints(catalogIds);
  }, [catalogIds, open, refreshSoldHints]);

  useEffect(() => {
    if (!open) return;
    setRightsByItem((prev) => {
      const next = { ...prev };
      for (const id of catalogIds) {
        if (!next[id]) next[id] = defaultRights();
      }
      for (const k of Object.keys(next)) {
        if (!catalogIds.includes(k)) delete next[k];
      }
      return next;
    });
  }, [catalogIds, open]);

  const runValidation = useCallback(
    async (itemId: string, form: RightsForm) => {
      const body = {
        catalogItemId: itemId,
        adminOverride,
        selection: {
          catalogItemId: itemId,
          territoryCodes: form.territoryCodes,
          startAt: form.startAt || undefined,
          endAt: form.endAt || undefined,
          platforms: form.platforms,
          exclusivity: form.exclusivity,
        },
      };
      try {
        const v = await v1Fetch<ValidateResult>("/deals/rights/validate", {
          method: "POST",
          body: JSON.stringify(body),
        });
        setValidateByItem((prev) => ({ ...prev, [itemId]: v }));
      } catch {
        setValidateByItem((prev) => ({ ...prev, [itemId]: null }));
      }
    },
    [adminOverride],
  );

  useEffect(() => {
    if (!open || step !== 2) return;
    const t = setTimeout(() => {
      for (const id of catalogIds) {
        const f = rightsByItem[id];
        if (f) void runValidation(id, f);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [rightsByItem, catalogIds, open, step, runValidation]);

  async function createInlineCounterparty() {
    setLoading(true);
    setErr(null);
    try {
      const orgType = dealKind === "sale" ? "client" : "rights_holder";
      const org = await v1Fetch<Org>("/organizations", {
        method: "POST",
        body: JSON.stringify({
          legalName: newClientName.trim(),
          country: newClientCountry.trim().toUpperCase().slice(0, 2),
          type: orgType,
          isResident: true,
        }),
      });
      const appendSorted = (prev: Org[]) =>
        [...prev, org].sort((a, b) =>
          a.legalName.localeCompare(b.legalName, "ru"),
        );
      if (dealKind === "sale") setClientOrgs(appendSorted);
      else setRightsHolderOrgs(appendSorted);
      setBuyerOrgId(org.id);
      setInlineClientOpen(false);
      setNewClientName("");
    } catch (e) {
      setErr(
        e instanceof Error ? e.message : "Ошибка создания контрагента",
      );
    } finally {
      setLoading(false);
    }
  }

  async function submitDeal() {
    setLoading(true);
    setErr(null);
    try {
      const rightsSelections = catalogIds.map((id) => {
        const f = rightsByItem[id] ?? defaultRights();
        return {
          catalogItemId: id,
          territoryCodes: f.territoryCodes,
          startAt: f.startAt || undefined,
          endAt: f.endAt || undefined,
          platforms: f.platforms,
          exclusivity: f.exclusivity,
        };
      });
      const prefix = dealKind === "purchase" ? "ПОКУПКА" : "ПРОДАЖА";
      const rest = titleSuffix.trim();
      const fullTitle = rest ? `${prefix} ${rest}` : prefix;
      const deal = await v1Fetch<{ id: string }>("/deals", {
        method: "POST",
        body: JSON.stringify({
          title: fullTitle,
          kind: dealKind,
          buyerOrgId,
          ownerUserId,
          currency: "KZT",
          catalogItemIds: catalogIds,
          commercialExpectedValue: normalizeMoneyInput(expectedValue) || undefined,
          vatIncluded,
          rightsSelections,
          adminOverride: adminOverride || undefined,
        }),
      });
      onOpenChange(false);
      onCreated(deal.id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка создания сделки");
    } finally {
      setLoading(false);
    }
  }

  const step2Blocked =
    step === 2 &&
    !adminOverride &&
    catalogIds.some((id) => validateByItem[id]?.canContinue === false);

  function toggleCatalog(id: string) {
    setCatalogIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function toggleTerritory(itemId: string, code: string) {
    setRightsByItem((prev) => {
      const f = { ...(prev[itemId] ?? defaultRights()) };
      const set = new Set(f.territoryCodes);
      if (set.has(code)) set.delete(code);
      else set.add(code);
      f.territoryCodes = [...set];
      return { ...prev, [itemId]: f };
    });
  }

  function togglePlatform(itemId: string, p: string) {
    setRightsByItem((prev) => {
      const f = { ...(prev[itemId] ?? defaultRights()) };
      const set = new Set(f.platforms);
      if (set.has(p)) set.delete(p);
      else set.add(p);
      f.platforms = [...set];
      return { ...prev, [itemId]: f };
    });
  }

  function openNewCatalogDialog() {
    setNewCatalogFormKey((k) => k + 1);
    setNewCatalogOpen(true);
  }

  async function onNewCatalogCreated(createdId: string) {
    setErr(null);
    try {
      const c = await v1Fetch<CatalogItem[]>("/catalog/items");
      setCatalog(c);
      setCatalogIds((prev) => {
        const next = prev.includes(createdId) ? prev : [...prev, createdId];
        void refreshSoldHints(next);
        return next;
      });
      setNewCatalogOpen(false);
    } catch (e) {
      setErr(
        e instanceof Error ? e.message : "Не удалось обновить список каталога",
      );
    }
  }

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === 1 ? "Шаг 1: создание сделки" : "Шаг 2: выбор прав"}
          </DialogTitle>
        </DialogHeader>

        {err && (
          <p className="text-sm text-destructive whitespace-pre-wrap">{err}</p>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <Label>Тип сделки</Label>
              <p className="text-xs text-muted-foreground mt-0.5 mb-2">
                Продажа — лицензируем контент клиенту. Покупка — приобретаем
                права у правообладателя.
              </p>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="dealKind"
                    className="accent-primary"
                    checked={dealKind === "sale"}
                    onChange={() => {
                      setDealKind("sale");
                      setBuyerOrgId("");
                      setInlineClientOpen(false);
                    }}
                  />
                  Продажа
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="dealKind"
                    className="accent-primary"
                    checked={dealKind === "purchase"}
                    onChange={() => {
                      setDealKind("purchase");
                      setBuyerOrgId("");
                      setInlineClientOpen(false);
                    }}
                  />
                  Покупка
                </label>
              </div>
            </div>

            <div>
              <Label>
                {dealKind === "sale"
                  ? "Клиент (лицензиат)"
                  : "Правообладатель (продавец прав)"}
              </Label>
              <Input
                placeholder="Поиск…"
                value={clientQuery}
                onChange={(e) => setClientQuery(e.target.value)}
                className="mt-1"
              />
              <div className="mt-2 max-h-32 overflow-auto rounded border border-border">
                {filteredCounterparties.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={cn(
                      "w-full text-left px-3 py-2 text-sm hover:bg-muted",
                      buyerOrgId === c.id && "bg-primary/10",
                    )}
                    onClick={() => setBuyerOrgId(c.id)}
                  >
                    {c.legalName} ({c.country})
                  </button>
                ))}
              </div>
              {!inlineClientOpen ? (
                <Button
                  type="button"
                  variant="outline"
                  className="mt-2"
                  onClick={() => setInlineClientOpen(true)}
                >
                  {dealKind === "sale"
                    ? "+ Новый клиент"
                    : "+ Новый правообладатель"}
                </Button>
              ) : (
                <div className="mt-2 space-y-2 rounded-lg border border-border p-3">
                  <Input
                    placeholder="Юридическое название"
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                  />
                  <Input
                    placeholder="Страна (ISO2)"
                    value={newClientCountry}
                    onChange={(e) => setNewClientCountry(e.target.value)}
                    maxLength={2}
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void createInlineCounterparty()}
                      disabled={loading || !newClientName.trim()}
                    >
                      Создать
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setInlineClientOpen(false)}
                    >
                      Отмена
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div>
              <Label>Контент (мультивыбор)</Label>
              <div className="mt-2 space-y-2 max-h-40 overflow-auto border border-border rounded p-2">
                {catalog.map((item) => (
                  <label
                    key={item.id}
                    className="flex items-center gap-2 text-sm cursor-pointer"
                  >
                    <Checkbox
                      checked={catalogIds.includes(item.id)}
                      onCheckedChange={() => toggleCatalog(item.id)}
                    />
                    {item.title}
                  </label>
                ))}
              </div>
              {soldHintIds.length > 0 && (
                <p className="mt-2 text-sm text-amber-700 dark:text-amber-400">
                  Некоторые права уже проданы (есть активные сделки на выбранные
                  единицы каталога).
                </p>
              )}
              <Button
                type="button"
                variant="outline"
                className="mt-2"
                onClick={openNewCatalogDialog}
              >
                Добавить новый контент
              </Button>
            </div>

            <div>
              <Label>Ожидаемая сумма</Label>
              <Input
                className="mt-1 font-mono"
                value={expectedValue}
                onChange={(e) => setExpectedValue(e.target.value)}
                onBlur={() =>
                  setExpectedValue((prev) => formatMoneyAmountOrEmpty(prev))
                }
                placeholder="1 500 000"
              />
              <label className="mt-2 inline-flex items-center gap-2 text-sm">
                <Checkbox
                  checked={vatIncluded}
                  onCheckedChange={(v) => setVatIncluded(v === true)}
                />
                {isPurchaseNonKzCounterparty ? "С КПН" : "Оплата с НДС"}
              </label>
            </div>

            <div>
              <Label>Менеджер</Label>
              <select
                className="mt-1 w-full rounded-md border border-border/50 bg-input-background px-3 py-2 text-sm"
                value={ownerUserId}
                onChange={(e) => setOwnerUserId(e.target.value)}
              >
                {managers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.displayName?.trim() || m.email} ({m.role})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label>Название сделки</Label>
              <p className="text-xs text-muted-foreground mt-0.5 mb-1.5">
                Тип сделки фиксируется в начале названия и не редактируется.
              </p>
              <div className="mt-1 flex rounded-md border border-border/50 bg-input-background overflow-hidden focus-within:ring-2 focus-within:ring-ring/25 focus-within:ring-offset-2 ring-offset-background">
                <span
                  className="shrink-0 flex items-center px-3 text-sm font-semibold tracking-wide bg-muted/80 border-r border-border/50 text-foreground select-none"
                  aria-hidden
                >
                  {dealKind === "purchase" ? "ПОКУПКА" : "ПРОДАЖА"}
                </span>
                <Input
                  className="border-0 rounded-none shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 min-w-0 flex-1 bg-transparent"
                  value={titleSuffix}
                  onChange={(e) => setTitleSuffix(e.target.value)}
                  placeholder="Пакет OTT — Казахстан"
                  autoComplete="off"
                />
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={adminOverride}
                onCheckedChange={(v) => setAdminOverride(v === true)}
              />
              Разрешить override конфликтов (admin)
            </label>

            {catalogIds.map((itemId) => {
              const item = catalog.find((c) => c.id === itemId);
              const form = rightsByItem[itemId] ?? defaultRights();
              const v = validateByItem[itemId];
              const periodYearsHint = formatDateRangeYearsHint(
                form.startAt,
                form.endAt,
              );
              return (
                <div
                  key={itemId}
                  className="rounded-xl border border-border p-4 space-y-3"
                >
                  <p className="font-medium">{item?.title ?? itemId}</p>

                  <div>
                    <Label className="text-xs">Территории</Label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {DEAL_TERRITORY_PRESETS.map((t) => (
                        <label
                          key={t.code}
                          className="flex items-center gap-1 text-xs"
                        >
                          <Checkbox
                            checked={form.territoryCodes.includes(t.code)}
                            onCheckedChange={() =>
                              toggleTerritory(itemId, t.code)
                            }
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
                            setRightsByItem((p) => ({
                              ...p,
                              [itemId]: { ...form, startAt: e.target.value },
                            }))
                          }
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Окончание</Label>
                        <Input
                          type="date"
                          value={form.endAt}
                          onChange={(e) =>
                            setRightsByItem((p) => ({
                              ...p,
                              [itemId]: { ...form, endAt: e.target.value },
                            }))
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
                            onCheckedChange={() =>
                              togglePlatform(itemId, value)
                            }
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs">Формат лицензии</Label>
                    <select
                      className="mt-1 w-full rounded-md border border-border/50 bg-input-background px-2 py-1 text-sm"
                      value={form.exclusivity}
                      onChange={(e) =>
                        setRightsByItem((p) => ({
                          ...p,
                          [itemId]: {
                            ...form,
                            exclusivity: e.target.value as Exclusivity,
                          },
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

                  {v && (
                    <div className="text-xs space-y-1 rounded-md bg-muted/50 p-2">
                      {v.licenseGaps.length > 0 && (
                        <p className="text-destructive">
                          Нет лицензии на территории: {v.licenseGaps.join(", ")}{" "}
                          → Unavailable
                        </p>
                      )}
                      {v.blockingConflicts.length > 0 && (
                        <p className="text-destructive">
                          Конфликт: {v.blockingConflicts.map((c) => c.territory).join(", ")} —{" "}
                          заблокировано
                        </p>
                      )}
                      {v.partialOverlaps.length > 0 && (
                        <p className="text-amber-700 dark:text-amber-400">
                          Частичное пересечение:{" "}
                          {v.partialOverlaps.map((p) => p.territory).join(", ")} — уточните
                          доступность
                        </p>
                      )}
                      {v.canContinue ? (
                        <p className="text-emerald-700 dark:text-emerald-400">
                          Можно продолжить (Available по проверке)
                        </p>
                      ) : (
                        <p className="text-destructive">Continue заблокирован</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {step === 2 && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep(1)}
            >
              Назад
            </Button>
          )}
          {step === 1 && (
            <Button
              type="button"
              onClick={() => setStep(2)}
              disabled={
                !buyerOrgId ||
                !titleSuffix.trim() ||
                !ownerUserId ||
                catalogIds.length === 0
              }
            >
              Далее: права
            </Button>
          )}
          {step === 2 && (
            <Button
              type="button"
              onClick={() => void submitDeal()}
              disabled={loading || step2Blocked || catalogIds.length === 0}
            >
              Создать сделку
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={newCatalogOpen} onOpenChange={setNewCatalogOpen}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto z-[100]">
        <DialogHeader>
          <DialogTitle>Новый контент</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground -mt-2">
          После создания позиция будет отмечена в списке контента сделки и
          доступна на шаге «права».
        </p>
        <NewCatalogItemForm
          key={newCatalogFormKey}
          layout="embedded"
          submitLabel="Создать и добавить к сделке"
          onCreated={(id) => void onNewCatalogCreated(id)}
          onCancel={() => setNewCatalogOpen(false)}
        />
      </DialogContent>
    </Dialog>
    </>
  );
}
