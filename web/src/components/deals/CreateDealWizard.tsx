"use client";

import { toast } from "sonner";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/figma/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter as AlertDialogFooterEl,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/figma/components/ui/alert-dialog";
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
  languageRights: string[];
  holdback: string;
};

const defaultRights = (): RightsForm => ({
  territoryCodes: ["KZ"],
  startAt: "",
  endAt: "",
  platforms: ["TV"],
  exclusivity: "non_exclusive",
  languageRights: [],
  holdback: "",
});

const PAYMENT_MODELS = [
  "Фиксированный платёж",
  "Минимальная гарантия (MG)",
  "Ревенью-шер",
  "Гибрид (фикс + доля)",
  "За эпизод",
  "Рассрочка",
  "Бартер/промо",
] as const;

const LANGUAGE_OPTIONS = ["RU", "KZ", "EN", "TR", "AR", "ZH"] as const;

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
  // Доп. поля нового клиента (площадки)
  const [newClientPrimaryLanguages, setNewClientPrimaryLanguages] = useState("");
  const [newClientPreferredGenres, setNewClientPreferredGenres] = useState("");
  const [newClientExclusivityReadiness, setNewClientExclusivityReadiness] = useState("");
  const [newClientPreferredTerm, setNewClientPreferredTerm] = useState("");
  const [newClientAverageBudget, setNewClientAverageBudget] = useState("");
  const [newClientPaymentDiscipline, setNewClientPaymentDiscipline] = useState("");
  const [newClientTechRequirements, setNewClientTechRequirements] = useState("");
  const [newClientContactName, setNewClientContactName] = useState("");
  const [newClientContactEmail, setNewClientContactEmail] = useState("");
  const [newClientContactPhone, setNewClientContactPhone] = useState("");
  const [newClientNotes, setNewClientNotes] = useState("");

  /** Только пользовательская часть; префикс ПРОДАЖА/ПОКУПКА добавляется при сохранении. */
  const [titleSuffix, setTitleSuffix] = useState("");
  const [catalogIds, setCatalogIds] = useState<string[]>([]);
  const [expectedValue, setExpectedValue] = useState("");
  const [currency, setCurrency] = useState("KZT");
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
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);

  // Дополнительные поля (общие для продажи и закупа)
  const [signedAt, setSignedAt] = useState("");
  const [effectiveAt, setEffectiveAt] = useState("");
  const [paymentModel, setPaymentModel] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [deliveryDeadline, setDeliveryDeadline] = useState("");
  const [dealNotes, setDealNotes] = useState("");
  // Только для продажи
  const [minimumGuarantee, setMinimumGuarantee] = useState("");

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
    setNewClientName("");
    setNewClientCountry("KZ");
    setNewClientPrimaryLanguages("");
    setNewClientPreferredGenres("");
    setNewClientExclusivityReadiness("");
    setNewClientPreferredTerm("");
    setNewClientAverageBudget("");
    setNewClientPaymentDiscipline("");
    setNewClientTechRequirements("");
    setNewClientContactName("");
    setNewClientContactEmail("");
    setNewClientContactPhone("");
    setNewClientNotes("");
    if (!wizardSeed) {
      setBuyerOrgId("");
      setCatalogIds([]);
      setTitleSuffix("");
      setExpectedValue("");
      setCurrency("KZT");
      setVatIncluded(true);
      setClientQuery("");
      setOwnerUserId("");
      setSignedAt("");
      setEffectiveAt("");
      setPaymentModel("");
      setPaymentTerms("");
      setDeliveryDeadline("");
      setDealNotes("");
      setMinimumGuarantee("");
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
          ...(newClientPrimaryLanguages.trim() && { primaryLanguages: newClientPrimaryLanguages.trim() }),
          ...(newClientPreferredGenres.trim() && { preferredGenres: newClientPreferredGenres.trim() }),
          ...(newClientExclusivityReadiness && { exclusivityReadiness: newClientExclusivityReadiness }),
          ...(newClientPreferredTerm.trim() && { preferredTerm: newClientPreferredTerm.trim() }),
          ...(newClientAverageBudget.trim() && { averageBudget: newClientAverageBudget.trim() }),
          ...(newClientPaymentDiscipline && { paymentDiscipline: newClientPaymentDiscipline }),
          ...(newClientTechRequirements.trim() && { techRequirements: newClientTechRequirements.trim() }),
          ...(newClientContactName.trim() && { contactName: newClientContactName.trim() }),
          ...(newClientContactEmail.trim() && { contactEmail: newClientContactEmail.trim() }),
          ...(newClientContactPhone.trim() && { contactPhone: newClientContactPhone.trim() }),
          ...(newClientNotes.trim() && { notes: newClientNotes.trim() }),
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
      toast.success("Контрагент создан");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка создания контрагента");
      setErr(e instanceof Error ? e.message : "Ошибка создания контрагента");
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
          languageRights: f.languageRights.length ? f.languageRights : undefined,
          holdback: f.holdback.trim() || undefined,
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
          currency,
          catalogItemIds: catalogIds,
          commercialExpectedValue: normalizeMoneyInput(expectedValue) || undefined,
          vatIncluded,
          rightsSelections,
          adminOverride: adminOverride || undefined,
          signedAt: signedAt || undefined,
          paymentModel: paymentModel || undefined,
          paymentTerms: paymentTerms.trim() || undefined,
          notes: dealNotes.trim() || undefined,
          ...(dealKind === "purchase" && {
            effectiveAt: effectiveAt || undefined,
            deliveryDeadline: deliveryDeadline || undefined,
          }),
          ...(dealKind === "sale" && {
            minimumGuarantee: normalizeMoneyInput(minimumGuarantee) || undefined,
          }),
        }),
      });
      onOpenChange(false);
      toast.success("Сделка создана");
      onCreated(deal.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка создания сделки");
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

  const isDirty =
    buyerOrgId !== "" ||
    titleSuffix !== "" ||
    catalogIds.length > 0 ||
    expectedValue !== "" ||
    signedAt !== "" ||
    paymentModel !== "" ||
    minimumGuarantee !== "";

  function handleOpenChange(v: boolean) {
    if (!v && isDirty) {
      setCloseConfirmOpen(true);
      return;
    }
    onOpenChange(v);
  }

  return (
    <>
    <AlertDialog open={closeConfirmOpen} onOpenChange={setCloseConfirmOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Закрыть визард?</AlertDialogTitle>
          <AlertDialogDescription>
            Вы уже заполнили некоторые поля. При закрытии введённые данные будут потеряны.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooterEl>
          <AlertDialogCancel>Продолжить заполнение</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => {
              setCloseConfirmOpen(false);
              onOpenChange(false);
            }}
          >
            Закрыть без сохранения
          </AlertDialogAction>
        </AlertDialogFooterEl>
      </AlertDialogContent>
    </AlertDialog>

    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === 1 ? "Новая сделка" : "Параметры прав"}
          </DialogTitle>
          {/* Step progress indicator */}
          <div className="flex items-center gap-2 pt-1">
            {[1, 2].map((s) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                  step === s
                    ? "bg-primary text-primary-foreground"
                    : step > s
                    ? "bg-success text-white"
                    : "bg-muted text-muted-foreground"
                }`}>
                  {s}
                </div>
                <span className={`text-xs font-medium ${step === s ? "text-foreground" : "text-muted-foreground"}`}>
                  {s === 1 ? "Основное" : "Права"}
                </span>
                {s < 2 && <div className="h-px w-8 bg-border" />}
              </div>
            ))}
          </div>
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

              {/* Диалог создания нового клиента/правообладателя */}
              <Dialog open={inlineClientOpen} onOpenChange={setInlineClientOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>
                      {dealKind === "sale" ? "Новый клиент (площадка)" : "Новый правообладатель"}
                    </DialogTitle>
                  </DialogHeader>

                  <div className="space-y-4 py-2">
                    {/* Основные реквизиты */}
                    <div className="rounded-lg border border-border/60 bg-muted/20 p-4 space-y-3">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Основные реквизиты
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                          <Label className="text-xs">Название площадки / юридическое название *</Label>
                          <Input
                            className="mt-1"
                            placeholder="ООО «КинопоискHD»"
                            value={newClientName}
                            onChange={(e) => setNewClientName(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Страна (ISO2) *</Label>
                          <Input
                            className="mt-1"
                            placeholder="KZ"
                            value={newClientCountry}
                            onChange={(e) => setNewClientCountry(e.target.value.toUpperCase())}
                            maxLength={2}
                          />
                        </div>
                      </div>
                    </div>

                    {dealKind === "sale" && (
                      <>
                        {/* Контентные предпочтения */}
                        <div className="rounded-lg border border-border/60 bg-muted/20 p-4 space-y-3">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            Контентные предпочтения
                          </p>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label className="text-xs">Основные языки</Label>
                              <Input
                                className="mt-1"
                                placeholder="RU, KZ, EN"
                                value={newClientPrimaryLanguages}
                                onChange={(e) => setNewClientPrimaryLanguages(e.target.value)}
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Предпочитаемые жанры</Label>
                              <Input
                                className="mt-1"
                                placeholder="Драма, Комедия, Документальное"
                                value={newClientPreferredGenres}
                                onChange={(e) => setNewClientPreferredGenres(e.target.value)}
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Готовность к эксклюзиву</Label>
                              <select
                                className="mt-1 w-full rounded-md border border-border/50 bg-input-background px-3 py-2 text-sm"
                                value={newClientExclusivityReadiness}
                                onChange={(e) => setNewClientExclusivityReadiness(e.target.value)}
                              >
                                <option value="">— не указано —</option>
                                <option value="Да">Да</option>
                                <option value="Частично">Частично</option>
                                <option value="Нет">Нет</option>
                              </select>
                            </div>
                            <div>
                              <Label className="text-xs">Предпочтительный срок</Label>
                              <Input
                                className="mt-1"
                                placeholder="1–3 года"
                                value={newClientPreferredTerm}
                                onChange={(e) => setNewClientPreferredTerm(e.target.value)}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Коммерческие параметры */}
                        <div className="rounded-lg border border-border/60 bg-muted/20 p-4 space-y-3">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            Коммерческие параметры
                          </p>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label className="text-xs">Средний бюджет</Label>
                              <Input
                                className="mt-1"
                                placeholder="$10 000 – $50 000"
                                value={newClientAverageBudget}
                                onChange={(e) => setNewClientAverageBudget(e.target.value)}
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Платежная дисциплина</Label>
                              <select
                                className="mt-1 w-full rounded-md border border-border/50 bg-input-background px-3 py-2 text-sm"
                                value={newClientPaymentDiscipline}
                                onChange={(e) => setNewClientPaymentDiscipline(e.target.value)}
                              >
                                <option value="">— не указано —</option>
                                <option value="Высокая">Высокая</option>
                                <option value="Средняя">Средняя</option>
                                <option value="Низкая">Низкая</option>
                              </select>
                            </div>
                            <div className="col-span-2">
                              <Label className="text-xs">Тех. требования к материалам</Label>
                              <Input
                                className="mt-1"
                                placeholder="ProRes 4K, субтитры SRT, постер 2000×3000"
                                value={newClientTechRequirements}
                                onChange={(e) => setNewClientTechRequirements(e.target.value)}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Контактное лицо */}
                        <div className="rounded-lg border border-border/60 bg-muted/20 p-4 space-y-3">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            Контактное лицо
                          </p>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2">
                              <Label className="text-xs">Основной контакт (ФИО)</Label>
                              <Input
                                className="mt-1"
                                placeholder="Иванов Иван Иванович"
                                value={newClientContactName}
                                onChange={(e) => setNewClientContactName(e.target.value)}
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Эл. почта</Label>
                              <Input
                                className="mt-1"
                                type="email"
                                placeholder="manager@platform.kz"
                                value={newClientContactEmail}
                                onChange={(e) => setNewClientContactEmail(e.target.value)}
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Телефон</Label>
                              <Input
                                className="mt-1"
                                placeholder="+7 700 000 00 00"
                                value={newClientContactPhone}
                                onChange={(e) => setNewClientContactPhone(e.target.value)}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Примечания */}
                        <div>
                          <Label className="text-xs">Примечания</Label>
                          <textarea
                            className="mt-1 w-full rounded-md border border-border/50 bg-input-background px-3 py-2 text-sm resize-none min-h-[72px] focus:outline-none focus:ring-2 focus:ring-ring/25"
                            placeholder="Любые важные условия или комментарии по площадке"
                            value={newClientNotes}
                            onChange={(e) => setNewClientNotes(e.target.value)}
                          />
                        </div>
                      </>
                    )}
                  </div>

                  <DialogFooter>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setInlineClientOpen(false)}
                    >
                      Отмена
                    </Button>
                    <Button
                      type="button"
                      onClick={() => void createInlineCounterparty()}
                      disabled={loading || !newClientName.trim()}
                    >
                      Создать
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
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
              <div className="mt-1 flex gap-2">
                <Input
                  className="font-mono flex-1"
                  value={expectedValue}
                  onChange={(e) => setExpectedValue(e.target.value)}
                  onBlur={() =>
                    setExpectedValue((prev) => formatMoneyAmountOrEmpty(prev))
                  }
                  placeholder="1 500 000"
                />
                <select
                  className="w-24 rounded-md border border-border/50 bg-input-background px-2 py-2 text-sm font-mono"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  aria-label="Валюта"
                >
                  {["KZT", "USD", "EUR", "RUB"].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <label className="mt-2 inline-flex items-center gap-2 text-sm">
                <Checkbox
                  checked={vatIncluded}
                  onCheckedChange={(v) => setVatIncluded(v === true)}
                />
                {isPurchaseNonKzCounterparty ? "С КПН" : "Оплата с НДС"}
              </label>
            </div>

            {dealKind === "purchase" && (
              <div className="rounded-lg border border-border/60 bg-muted/20 p-4 space-y-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Параметры закупа
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Дата подписания</Label>
                    <Input
                      type="date"
                      className="mt-1"
                      value={signedAt}
                      onChange={(e) => setSignedAt(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Дата вступления в силу</Label>
                    <Input
                      type="date"
                      className="mt-1"
                      value={effectiveAt}
                      onChange={(e) => setEffectiveAt(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Модель оплаты</Label>
                  <select
                    className="mt-1 w-full rounded-md border border-border/50 bg-input-background px-3 py-2 text-sm"
                    value={paymentModel}
                    onChange={(e) => setPaymentModel(e.target.value)}
                  >
                    <option value="">— не указано —</option>
                    {PAYMENT_MODELS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Условия оплаты</Label>
                  <Input
                    className="mt-1"
                    placeholder="Например: 30 дней с даты подписания"
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Срок поставки материалов</Label>
                  <Input
                    type="date"
                    className="mt-1"
                    value={deliveryDeadline}
                    onChange={(e) => setDeliveryDeadline(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Примечания</Label>
                  <textarea
                    className="mt-1 w-full rounded-md border border-border/50 bg-input-background px-3 py-2 text-sm resize-none min-h-[72px] focus:outline-none focus:ring-2 focus:ring-ring/25"
                    placeholder="Любые важные условия или комментарии по сделке"
                    value={dealNotes}
                    onChange={(e) => setDealNotes(e.target.value)}
                  />
                </div>
              </div>
            )}

            {dealKind === "sale" && (
              <div className="rounded-lg border border-border/60 bg-muted/20 p-4 space-y-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Параметры продажи
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Дата подписания</Label>
                    <Input
                      type="date"
                      className="mt-1"
                      value={signedAt}
                      onChange={(e) => setSignedAt(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Минимальная гарантия (MG)</Label>
                    <Input
                      className="mt-1"
                      placeholder="0.00"
                      value={minimumGuarantee}
                      onChange={(e) =>
                        setMinimumGuarantee(normalizeMoneyInput(e.target.value))
                      }
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Модель оплаты</Label>
                  <select
                    className="mt-1 w-full rounded-md border border-border/50 bg-input-background px-3 py-2 text-sm"
                    value={paymentModel}
                    onChange={(e) => setPaymentModel(e.target.value)}
                  >
                    <option value="">— не указано —</option>
                    {PAYMENT_MODELS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Условия оплаты</Label>
                  <Input
                    className="mt-1"
                    placeholder="Например: 30 дней с даты выхода контента"
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Примечания</Label>
                  <textarea
                    className="mt-1 w-full rounded-md border border-border/50 bg-input-background px-3 py-2 text-sm resize-none min-h-[72px] focus:outline-none focus:ring-2 focus:ring-ring/25"
                    placeholder="Любые важные условия или комментарии по сделке"
                    value={dealNotes}
                    onChange={(e) => setDealNotes(e.target.value)}
                  />
                </div>
              </div>
            )}

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

                  <div>
                    <Label className="text-xs">Языковые права</Label>
                    <div className="flex flex-wrap gap-3 mt-1">
                      {LANGUAGE_OPTIONS.map((lang) => (
                        <label key={lang} className="flex items-center gap-1 text-xs">
                          <Checkbox
                            checked={form.languageRights.includes(lang)}
                            onCheckedChange={() =>
                              setRightsByItem((p) => {
                                const f = { ...(p[itemId] ?? defaultRights()) };
                                const set = new Set(f.languageRights);
                                if (set.has(lang)) set.delete(lang);
                                else set.add(lang);
                                f.languageRights = [...set];
                                return { ...p, [itemId]: f };
                              })
                            }
                          />
                          {lang}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs">Окно / холдбэк</Label>
                    <Input
                      className="mt-1"
                      placeholder="Например: 6 мес. после театрального релиза"
                      value={form.holdback}
                      onChange={(e) =>
                        setRightsByItem((p) => ({
                          ...p,
                          [itemId]: { ...form, holdback: e.target.value },
                        }))
                      }
                    />
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
