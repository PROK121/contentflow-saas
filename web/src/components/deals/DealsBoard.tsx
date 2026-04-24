"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import {
  Plus,
  MoreVertical,
  User,
  Calendar,
  TrendingUp,
  RefreshCw,
  GripVertical,
  Archive,
  ArchiveRestore,
  Trash2,
} from "lucide-react";
import { CreateDealWizard, type WizardSeed } from "./CreateDealWizard";
import { v1Fetch } from "@/lib/v1-client";
import { isAdminDeleteEmail } from "@/lib/admin-delete-email";
import { formatMoneyAmount, parseMoneyNumber } from "@/lib/format-money";
import { getPlatformOwnerUserId } from "@/lib/platform-user";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/figma/components/ui/dropdown-menu";
import { Button } from "@/figma/components/ui/button";
import { Input } from "@/figma/components/ui/input";
import { Label } from "@/figma/components/ui/label";
import { Switch } from "@/figma/components/ui/switch";
import { Skeleton } from "@/figma/components/ui/skeleton";
import { cn } from "@/figma/components/ui/utils";

const pipelineStages = [
  { id: "lead", label: "Лиды", color: "bg-info/15", borderColor: "border-info/30", textColor: "text-info" },
  { id: "negotiation", label: "Переговоры", color: "bg-warning/15", borderColor: "border-warning/30", textColor: "text-warning" },
  { id: "contract", label: "Контракт", color: "bg-primary/15", borderColor: "border-primary/30", textColor: "text-primary" },
  { id: "paid", label: "Оплачено", color: "bg-success/15", borderColor: "border-success/30", textColor: "text-success" },
] as const;

const COLUMN_PAGE_SIZE = 35;

type ApiDeal = {
  id: string;
  title: string;
  kind?: string;
  stage: string;
  archived?: boolean;
  currency: string;
  updatedAt: string;
  buyerOrgId: string;
  ownerUserId: string;
  buyer: { legalName: string; country?: string };
  owner: { email: string; displayName?: string | null };
  catalogItems: { catalogItem: { title: string } }[];
  commercialSnapshot: Record<string, unknown> | null;
};

type Org = { id: string; legalName: string };
type Manager = {
  id: string;
  email: string;
  displayName?: string | null;
};
type CatalogRow = { id: string; title: string };

function parseExpectedNumber(s: Record<string, unknown> | null): number | null {
  if (!s) return null;
  const v = s.expectedValue;
  return parseMoneyNumber(
    typeof v === "number" || typeof v === "string" ? v : null,
  );
}

function parseNetNumberForCard(d: ApiDeal): number | null {
  const gross = parseExpectedNumber(d.commercialSnapshot);
  if (gross == null) return null;

  const vatIncluded = d.commercialSnapshot?.vatIncluded !== false;
  const projectAdministration = d.commercialSnapshot?.projectAdministration === true;
  const kind = d.kind ?? "sale";
  const country = (d.buyer.country ?? "").trim().toUpperCase();

  let net = gross;
  if (kind === "purchase") {
    if (country === "KZ") {
      net = vatIncluded ? gross * (1 - 0.16) : gross;
    } else {
      net = vatIncluded ? gross * (1 - 0.1) : gross;
    }
  } else {
    net = vatIncluded ? gross : gross * (1 + 0.16);
  }

  if (projectAdministration) {
    net -= 500000;
  }
  return net;
}

function columnMoneyBreakdown(deals: ApiDeal[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const d of deals) {
    const n = parseExpectedNumber(d.commercialSnapshot);
    if (n === null) continue;
    const c = (d.currency || "").trim().toUpperCase() || "—";
    m.set(c, (m.get(c) ?? 0) + n);
  }
  return m;
}

function ColumnTotalsMoney({ deals }: { deals: ApiDeal[] }) {
  const m = columnMoneyBreakdown(deals);
  if (m.size === 0) return <>—</>;
  const entries = [...m.entries()];
  if (entries.length === 1) {
    const [cur, val] = entries[0];
    return (
      <>
        {formatMoneyAmount(val)} {cur}
      </>
    );
  }
  return (
    <span className="block text-left leading-snug">
      {entries.map(([cur, val]) => (
        <span key={cur} className="block">
          {formatMoneyAmount(val)} {cur}
        </span>
      ))}
    </span>
  );
}

function readFiltersFromSearchParams(sp: URLSearchParams): {
  qVal: string;
  filterOwner: string;
  filterBuyer: string;
  filterCurrency: string;
  filterKind: "" | "sale" | "purchase";
  filterCatalogId: string;
  amountMin: string;
  amountMax: string;
  onlyMine: boolean;
  autoRefreshTab: boolean;
  showArchived: boolean;
} {
  const qVal = sp.get("q") ?? "";
  const k = sp.get("kind") ?? "";
  const uid = getPlatformOwnerUserId();
  const createMode = sp.get("create") === "1";
  const filterKind: "" | "sale" | "purchase" =
    k === "sale" || k === "purchase" ? k : "";
  return {
    qVal,
    filterOwner: sp.get("ownerUserId") ?? "",
    filterBuyer: createMode ? "" : (sp.get("buyerOrgId") ?? ""),
    filterCurrency: sp.get("currency") ?? "",
    filterKind,
    filterCatalogId: createMode ? "" : (sp.get("catalogItemId") ?? ""),
    amountMin: sp.get("amountMin") ?? "",
    amountMax: sp.get("amountMax") ?? "",
    onlyMine: uid ? sp.get("mine") === "1" : false,
    autoRefreshTab: sp.get("autorefresh") === "1",
    showArchived: sp.get("archived") === "1" || sp.get("archived") === "true",
  };
}

function BoardSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {pipelineStages.map((s) => (
        <div key={s.id} className="space-y-3">
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-28 w-full rounded-lg" />
          <Skeleton className="h-28 w-full rounded-lg" />
        </div>
      ))}
    </div>
  );
}

export function DealsBoard() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [urlReady, setUrlReady] = useState(false);
  const [deals, setDeals] = useState<ApiDeal[]>([]);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardSeed, setWizardSeed] = useState<WizardSeed | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [searchQ, setSearchQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [filterOwner, setFilterOwner] = useState("");
  const [filterBuyer, setFilterBuyer] = useState("");
  const [filterCurrency, setFilterCurrency] = useState("");
  const [filterKind, setFilterKind] = useState<"" | "sale" | "purchase">("");
  const [filterCatalogId, setFilterCatalogId] = useState("");
  const [amountMin, setAmountMin] = useState("");
  const [amountMax, setAmountMax] = useState("");
  const [onlyMine, setOnlyMine] = useState(false);
  const [autoRefreshTab, setAutoRefreshTab] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const [filterClients, setFilterClients] = useState<Org[]>([]);
  const [filterManagers, setFilterManagers] = useState<Manager[]>([]);
  const [catalogItems, setCatalogItems] = useState<CatalogRow[]>([]);

  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [columnVisibleCount, setColumnVisibleCount] = useState<
    Record<string, number>
  >({});
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [deleteDealBusyId, setDeleteDealBusyId] = useState<string | null>(null);
  const canAdminDelete = isAdminDeleteEmail(authEmail);

  useEffect(() => {
    void v1Fetch<{ user: { email: string } }>("/auth/me")
      .then((r) => setAuthEmail(r.user.email))
      .catch(() => setAuthEmail(null));
  }, []);

  useLayoutEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const f = readFiltersFromSearchParams(sp);
    setSearchQ(f.qVal);
    setDebouncedQ(f.qVal);
    setFilterOwner(f.filterOwner);
    setFilterBuyer(f.filterBuyer);
    setFilterCurrency(f.filterCurrency);
    setFilterKind(f.filterKind);
    setFilterCatalogId(f.filterCatalogId);
    setAmountMin(f.amountMin);
    setAmountMax(f.amountMax);
    setOnlyMine(f.onlyMine);
    setAutoRefreshTab(f.autoRefreshTab);
    setShowArchived(f.showArchived);
    setUrlReady(true);
  }, []);

  useEffect(() => {
    const onPop = () => {
      const f = readFiltersFromSearchParams(
        new URLSearchParams(window.location.search),
      );
      setSearchQ(f.qVal);
      setDebouncedQ(f.qVal);
      setFilterOwner(f.filterOwner);
      setFilterBuyer(f.filterBuyer);
      setFilterCurrency(f.filterCurrency);
      setFilterKind(f.filterKind);
      setFilterCatalogId(f.filterCatalogId);
      setAmountMin(f.amountMin);
      setAmountMax(f.amountMax);
      setOnlyMine(f.onlyMine);
      setAutoRefreshTab(f.autoRefreshTab);
      setShowArchived(f.showArchived);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    if (!urlReady) return;
    const sp = new URLSearchParams();
    if (debouncedQ) sp.set("q", debouncedQ);
    if (filterOwner) sp.set("ownerUserId", filterOwner);
    if (filterBuyer) sp.set("buyerOrgId", filterBuyer);
    if (filterCurrency.trim()) sp.set("currency", filterCurrency.trim().toUpperCase());
    if (filterKind) sp.set("kind", filterKind);
    if (filterCatalogId) sp.set("catalogItemId", filterCatalogId);
    if (amountMin.trim()) sp.set("amountMin", amountMin.trim());
    if (amountMax.trim()) sp.set("amountMax", amountMax.trim());
    if (autoRefreshTab) sp.set("autorefresh", "1");
    if (showArchived) sp.set("archived", "1");
    const next = sp.toString();
    const cur = new URLSearchParams(window.location.search).toString();
    if (next !== cur) {
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
    }
  }, [
    urlReady,
    debouncedQ,
    filterOwner,
    filterBuyer,
    filterCurrency,
    filterKind,
    filterCatalogId,
    amountMin,
    amountMax,
    autoRefreshTab,
    showArchived,
    pathname,
    router,
  ]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(searchQ.trim()), 320);
    return () => clearTimeout(t);
  }, [searchQ]);

  const loadFilterOptions = useCallback(async () => {
    try {
      const [o, m, cat] = await Promise.all([
        v1Fetch<Org[]>("/organizations?type=client"),
        v1Fetch<Manager[]>("/users/managers"),
        v1Fetch<CatalogRow[]>("/catalog/items"),
      ]);
      setFilterClients(o);
      setFilterManagers(m);
      setCatalogItems(cat);
    } catch {
      /* ignore */
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedQ) params.set("q", debouncedQ);
      if (filterOwner) params.set("ownerUserId", filterOwner);
      if (filterBuyer) params.set("buyerOrgId", filterBuyer);
      if (filterCurrency.trim()) params.set("currency", filterCurrency.trim());
      if (filterKind) params.set("kind", filterKind);
      if (filterCatalogId.trim()) params.set("catalogItemId", filterCatalogId.trim());
      if (showArchived) params.set("archived", "true");
      const q = params.toString();
      const list = await v1Fetch<ApiDeal[]>(`/deals${q ? `?${q}` : ""}`);
      setDeals(list);
      setLoadErr(null);
    } catch (e) {
      setLoadErr(
        e instanceof Error ? e.message : "Не удалось загрузить сделки",
      );
    } finally {
      setLoading(false);
    }
  }, [
    debouncedQ,
    filterOwner,
    filterBuyer,
    filterCurrency,
    filterKind,
    filterCatalogId,
    showArchived,
  ]);

  useEffect(() => {
    if (!urlReady) return;
    void load();
  }, [load, urlReady]);

  useEffect(() => {
    void loadFilterOptions();
  }, [loadFilterOptions]);

  useEffect(() => {
    if (!autoRefreshTab) return;
    const onVis = () => {
      if (document.visibilityState === "visible") void load();
    };
    const onFocus = () => void load();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onFocus);
    };
  }, [load, autoRefreshTab]);

  useEffect(() => {
    if (searchParams.get("create") !== "1") return;
    const cid = searchParams.get("catalogItemId");
    const bid = searchParams.get("buyerOrgId");
    setWizardSeed({
      catalogItemIds: cid ? [cid] : undefined,
      buyerOrgId: bid ?? undefined,
    });
    setWizardOpen(true);
    router.replace(pathname, { scroll: false });
  }, [searchParams, router, pathname]);

  const filteredDeals = useMemo(() => {
    let list = deals;
    const minN = amountMin.trim() ? parseMoneyNumber(amountMin) : null;
    const maxN = amountMax.trim() ? parseMoneyNumber(amountMax) : null;
    if (minN !== null) {
      list = list.filter((d) => {
        const n = parseExpectedNumber(d.commercialSnapshot);
        return n !== null && n >= minN;
      });
    }
    if (maxN !== null) {
      list = list.filter((d) => {
        const n = parseExpectedNumber(d.commercialSnapshot);
        return n !== null && n <= maxN;
      });
    }
    return list;
  }, [deals, amountMin, amountMax]);

  function formatDeal(d: ApiDeal) {
    const net = parseNetNumberForCard(d);
    const value =
      net != null ? `${formatMoneyAmount(net)} ${d.currency}` : "—";
    const content =
      d.catalogItems.map((c) => c.catalogItem.title).join(", ") || "—";
    const date = new Date(d.updatedAt).toLocaleDateString("ru-RU");
    const k = d.kind ?? "sale";
    const kindLabel = k === "purchase" ? "Покупка" : "Продажа";
    const clientRoleLabel =
      k === "purchase" ? "Правообладатель" : "Клиент";
    const isResidentByCountry =
      (d.buyer.country ?? "").trim().toUpperCase() === "KZ";
    const stageLabel =
      pipelineStages.find((s) => s.id === d.stage)?.label ?? d.stage;
    return {
      id: d.id,
      title: d.title,
      stage: d.stage,
      stageLabel,
      kindLabel,
      clientRoleLabel,
      client: d.buyer.legalName,
      residencyLabel: isResidentByCountry ? "Резидент" : "Нерезидент",
      content,
      value,
      contact: d.owner.displayName?.trim() || "Менеджер не указан",
      date,
      probability: d.stage === "paid" ? 100 : d.stage === "contract" ? 95 : 60,
    };
  }

  function openNewDeal() {
    setWizardSeed(null);
    setWizardOpen(true);
  }

  async function duplicateDeal(id: string) {
    try {
      const created = await v1Fetch<{ id: string }>(`/deals/${id}/duplicate`, {
        method: "POST",
      });
      await load();
      router.push(`/deals/${created.id}`);
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "Ошибка дублирования");
    }
  }

  async function patchStage(dealId: string, stage: string) {
    const snapshot = deals;
    setDeals((prev) =>
      prev.map((d) => (d.id === dealId ? { ...d, stage } : d)),
    );
    try {
      await v1Fetch(`/deals/${dealId}`, {
        method: "PATCH",
        body: JSON.stringify({ stage }),
      });
    } catch (e) {
      setDeals(snapshot);
      setLoadErr(
        e instanceof Error ? e.message : "Не удалось сменить этап",
      );
    }
  }

  async function patchArchived(dealId: string, archived: boolean) {
    const snapshot = deals;
    setDeals((prev) => prev.filter((d) => d.id !== dealId));
    try {
      await v1Fetch(`/deals/${dealId}`, {
        method: "PATCH",
        body: JSON.stringify({ archived }),
      });
      await load();
    } catch (e) {
      setDeals(snapshot);
      setLoadErr(
        e instanceof Error ? e.message : "Не удалось обновить архив",
      );
    }
  }

  async function deleteDealForever(dealId: string) {
    if (
      !window.confirm(
        "Удалить сделку безвозвратно? Действие необратимо.",
      )
    ) {
      return;
    }
    setDeleteDealBusyId(dealId);
    try {
      await v1Fetch(`/deals/${dealId}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "Не удалось удалить");
    } finally {
      setDeleteDealBusyId(null);
    }
  }

  function resetFilters() {
    setSearchQ("");
    setDebouncedQ("");
    setFilterOwner("");
    setFilterBuyer("");
    setFilterCurrency("");
    setFilterKind("");
    setFilterCatalogId("");
    setAmountMin("");
    setAmountMax("");
    setOnlyMine(false);
    setShowArchived(false);
  }

  function visibleForStage(stageId: string) {
    return columnVisibleCount[stageId] ?? COLUMN_PAGE_SIZE;
  }

  function showMoreInStage(stageId: string, total: number) {
    const cur = visibleForStage(stageId);
    setColumnVisibleCount((p) => ({
      ...p,
      [stageId]: Math.min(cur + COLUMN_PAGE_SIZE, total),
    }));
  }

  return (
    <div className="space-y-6">
      <CreateDealWizard
        open={wizardOpen}
        wizardSeed={wizardSeed}
        onOpenChange={(v) => {
          setWizardOpen(v);
          if (!v) setWizardSeed(null);
        }}
        onCreated={(id) => {
          void load();
          router.push(`/deals/${id}`);
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap items-start justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-1">
            {showArchived ? "Архив сделок" : "Воронка сделок"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {showArchived
              ? "Список архивных сделок без колонок воронки. Они не отображаются на основной доске и не участвуют в проверке конфликтов прав."
              : "Фильтры в адресе страницы, перетаскивание и смена этапа из меню «⋯»"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => void load()}
            className="gap-1"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Обновить
          </Button>
          {showArchived ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setShowArchived(false)}
            >
              Воронка
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => setShowArchived(true)}
              >
                <Archive size={16} strokeWidth={2.5} />
                Архив
              </Button>
              <Button type="button" size="sm" className="gap-2" onClick={openNewDeal}>
                <Plus size={18} strokeWidth={2.5} />
                Новая сделка
              </Button>
            </>
          )}
        </div>
      </motion.div>

      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs">Поиск (название / клиент)</Label>
            <Input
              className="mt-1"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="Название сделки или клиент…"
            />
          </div>
          <div>
            <Label className="text-xs">Ответственный</Label>
            <select
              className="mt-1 w-full rounded-md border border-border/50 bg-input-background px-3 py-2 text-sm"
              value={filterOwner}
              onChange={(e) => setFilterOwner(e.target.value)}
            >
              <option value="">Все</option>
              {filterManagers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.displayName?.trim() || m.email}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-xs">Клиент</Label>
            <select
              className="mt-1 w-full rounded-md border border-border/50 bg-input-background px-3 py-2 text-sm"
              value={filterBuyer}
              onChange={(e) => setFilterBuyer(e.target.value)}
            >
              <option value="">Все</option>
              {filterClients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.legalName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-xs">Валюта (ISO3)</Label>
            <Input
              className="mt-1 uppercase"
              value={filterCurrency}
              onChange={(e) => setFilterCurrency(e.target.value)}
              placeholder="KZT"
              maxLength={3}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs">Тип сделки</Label>
            <select
              className="mt-1 w-full rounded-md border border-border/50 bg-input-background px-3 py-2 text-sm"
              value={filterKind}
              onChange={(e) =>
                setFilterKind(
                  e.target.value === "sale" || e.target.value === "purchase"
                    ? e.target.value
                    : "",
                )
              }
            >
              <option value="">Все</option>
              <option value="sale">Продажа</option>
              <option value="purchase">Покупка</option>
            </select>
          </div>
          <div>
            <Label className="text-xs">Объект каталога</Label>
            <select
              className="mt-1 w-full rounded-md border border-border/50 bg-input-background px-3 py-2 text-sm"
              value={filterCatalogId}
              onChange={(e) => setFilterCatalogId(e.target.value)}
            >
              <option value="">Все</option>
              {catalogItems.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-xs">Сумма от</Label>
            <Input
              className="mt-1 w-32"
              value={amountMin}
              onChange={(e) => setAmountMin(e.target.value)}
              placeholder="0"
            />
          </div>
          <div>
            <Label className="text-xs">Сумма до</Label>
            <Input
              className="mt-1 w-32"
              value={amountMax}
              onChange={(e) => setAmountMax(e.target.value)}
              placeholder="∞"
            />
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={resetFilters}>
            Сбросить
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-border">
          <Switch
            id="deals-autorefresh"
            checked={autoRefreshTab}
            onCheckedChange={setAutoRefreshTab}
          />
          <Label htmlFor="deals-autorefresh" className="text-sm font-normal cursor-pointer">
            Обновлять при возврате на вкладку / фокусе окна
          </Label>
        </div>
      </div>

      {loadErr && (
        <p className="text-sm text-destructive whitespace-pre-wrap">{loadErr}</p>
      )}

      {loading && deals.length === 0 ? (
        showArchived ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
          </div>
        ) : (
          <BoardSkeleton />
        )
      ) : showArchived ? (
        <div className="space-y-3">
          {filteredDeals.length === 0 ? (
            <p className="text-sm text-muted-foreground rounded-lg border border-dashed border-border bg-muted/20 px-4 py-8 text-center">
              В архиве нет сделок. Перенесите их из воронки через меню карточки «⋯» → «В архив».
            </p>
          ) : (
            filteredDeals.map((d, dealIndex) => {
              const deal = formatDeal(d);
              return (
                <motion.div
                  key={deal.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: dealIndex * 0.04 }}
                  className="rounded-lg bg-card border border-border hover:shadow-md transition-all duration-200 overflow-hidden"
                >
                  <div className="flex-1 min-w-0 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={`/deals/${deal.id}`}
                        className="flex-1 min-w-0 block hover:opacity-90"
                      >
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="text-[10px] font-bold uppercase tracking-wide rounded bg-muted px-2 py-0.5 text-muted-foreground border border-border">
                            {deal.stageLabel}
                          </span>
                        </div>
                        <p className="text-[10px] font-bold text-primary/90">
                          {deal.kindLabel}
                        </p>
                        <h4 className="font-semibold text-foreground text-base leading-snug mt-1 line-clamp-2">
                          {deal.content}
                        </h4>
                        <p className="text-[11px] text-muted-foreground line-clamp-1 font-medium mt-1">
                          {deal.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          <span className="text-muted-foreground/85">
                            {deal.clientRoleLabel}:
                          </span>{" "}
                          {deal.client} · {deal.residencyLabel}
                        </p>
                      </Link>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="p-1 rounded hover:bg-muted shrink-0"
                            aria-label="Действия"
                          >
                            <MoreVertical size={14} className="text-muted-foreground" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/deals/${deal.id}`}>Открыть</Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => void duplicateDeal(deal.id)}
                          >
                            Дублировать
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => void patchArchived(deal.id, false)}
                          >
                            <ArchiveRestore size={14} className="mr-2" />
                            Вернуть из архива
                          </DropdownMenuItem>
                          {canAdminDelete ? (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                disabled={deleteDealBusyId === deal.id}
                                onClick={() => void deleteDealForever(deal.id)}
                              >
                                <Trash2 size={14} className="mr-2" />
                                {deleteDealBusyId === deal.id
                                  ? "Удаление…"
                                  : "Удалить навсегда"}
                              </DropdownMenuItem>
                            </>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <Link href={`/deals/${deal.id}`} className="block mt-3">
                      <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded">
                        <span className="text-primary font-bold text-sm">₸</span>
                        <span
                          className="font-bold text-foreground text-sm"
                          style={{ fontFamily: "var(--font-mono)" }}
                        >
                          {deal.value}
                        </span>
                      </div>
                      <div className="space-y-1.5 text-xs text-muted-foreground mt-2">
                        <div className="flex items-center gap-2">
                          <User size={12} strokeWidth={2.5} />
                          <span className="font-medium">{deal.contact}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar size={12} strokeWidth={2.5} />
                          <span className="font-medium">Обновлено: {deal.date}</span>
                        </div>
                      </div>
                    </Link>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {pipelineStages.map((stage, index) => {
              const stageRaw = filteredDeals.filter((d) => d.stage === stage.id);
              return (
                <motion.div
                  key={stage.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`rounded-lg ${stage.color} border ${stage.borderColor} p-4 bg-card`}
                >
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-foreground uppercase tracking-wider">{stage.label}</p>
                    <div className="flex items-baseline gap-2">
                      <p className="text-2xl font-bold text-foreground">{stageRaw.length}</p>
                      <p className="text-xs text-muted-foreground font-semibold">сделок</p>
                    </div>
                    <div className="text-sm font-bold" style={{ fontFamily: "var(--font-mono)" }}>
                      <ColumnTotalsMoney deals={stageRaw} />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-4 gap-5">
            {pipelineStages.map((stage, stageIndex) => {
              const stageRaw = filteredDeals.filter((d) => d.stage === stage.id);
              const cap = visibleForStage(stage.id);
              const stageRawVisible = stageRaw.slice(0, cap);
              const stageDeals = stageRawVisible.map(formatDeal);

              return (
                <motion.div
                  key={stage.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: stageIndex * 0.1 }}
                  className="space-y-3"
                >
                  <div className={`rounded-lg ${stage.color} border ${stage.borderColor} p-4 bg-card`}>
                    <h3 className="font-bold text-foreground uppercase tracking-wide text-xs mb-1">{stage.label}</h3>
                    <p className="text-xs text-muted-foreground font-semibold">
                      {stageRaw.length} {stageRaw.length === 1 ? "сделка" : "сделок"}
                    </p>
                  </div>

                  <div
                    className={cn(
                      "space-y-3 min-h-[120px] rounded-lg transition-colors",
                      dragOverStage === stage.id && "bg-primary/5 ring-2 ring-primary/30",
                    )}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                      setDragOverStage(stage.id);
                    }}
                    onDragLeave={() => setDragOverStage(null)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOverStage(null);
                      const id = e.dataTransfer.getData("dealId");
                      if (id) void patchStage(id, stage.id);
                    }}
                  >
                    {stageDeals.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-border bg-muted/20 px-3 py-6 text-center text-xs text-muted-foreground">
                        Нет сделок на этом этапе — перетащите карточку сюда или смените этап в меню «⋯»
                      </div>
                    ) : null}
                    {stageDeals.map((deal, dealIndex) => (
                      <motion.div
                        key={deal.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: stageIndex * 0.1 + dealIndex * 0.05 }}
                        className="rounded-lg bg-card border border-border hover:shadow-md transition-all duration-200 flex overflow-hidden"
                      >
                        <button
                          type="button"
                          draggable
                          title="Перетащить в другую колонку"
                          className="shrink-0 px-1.5 py-4 text-muted-foreground hover:bg-muted cursor-grab active:cursor-grabbing border-r border-border"
                          onDragStart={(e) => {
                            e.dataTransfer.setData("dealId", deal.id);
                            e.dataTransfer.effectAllowed = "move";
                          }}
                          onDragEnd={() => setDragOverStage(null)}
                        >
                          <GripVertical size={16} />
                        </button>
                        <div className="flex-1 min-w-0 p-3 pr-2">
                          <div className="flex items-start justify-between gap-1">
                            <Link
                              href={`/deals/${deal.id}`}
                              className="flex-1 min-w-0 block hover:opacity-90"
                            >
                        <p className="text-[10px] font-bold text-primary/90">
                          {deal.kindLabel}
                        </p>
                        <h4 className="font-semibold text-foreground text-base leading-snug mt-1 line-clamp-2">
                          {deal.content}
                        </h4>
                        <p className="text-[11px] text-muted-foreground line-clamp-1 font-medium mt-1">
                          {deal.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          <span className="text-muted-foreground/85">
                            {deal.clientRoleLabel}:
                          </span>{" "}
                          {deal.client} · {deal.residencyLabel}
                        </p>
                            </Link>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  className="p-1 rounded hover:bg-muted shrink-0"
                                  aria-label="Действия"
                                >
                                  <MoreVertical size={14} className="text-muted-foreground" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem asChild>
                                  <Link href={`/deals/${deal.id}`}>Открыть</Link>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuSub>
                                  <DropdownMenuSubTrigger>На этап…</DropdownMenuSubTrigger>
                                  <DropdownMenuSubContent>
                                    {pipelineStages
                                      .filter((s) => s.id !== deal.stage)
                                      .map((s) => (
                                        <DropdownMenuItem
                                          key={s.id}
                                          onClick={() => void patchStage(deal.id, s.id)}
                                        >
                                          {s.label}
                                        </DropdownMenuItem>
                                      ))}
                                  </DropdownMenuSubContent>
                                </DropdownMenuSub>
                                <DropdownMenuItem
                                  onClick={() => void duplicateDeal(deal.id)}
                                >
                                  Дублировать
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => void patchArchived(deal.id, true)}
                                >
                                  <Archive size={14} className="mr-2" />
                                  В архив
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>

                          <Link href={`/deals/${deal.id}`} className="block mt-2">
                            <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded">
                              <span className="text-primary font-bold text-sm">₸</span>
                              <span className="font-bold text-foreground text-sm" style={{ fontFamily: "var(--font-mono)" }}>{deal.value}</span>
                            </div>

                            <div className="space-y-1.5 text-xs text-muted-foreground mt-2">
                              <div className="flex items-center gap-2">
                                <User size={12} strokeWidth={2.5} />
                                <span className="font-medium">{deal.contact}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Calendar size={12} strokeWidth={2.5} />
                                <span className="font-medium">{deal.date}</span>
                              </div>
                            </div>

                          </Link>
                        </div>
                      </motion.div>
                    ))}
                    {stageRaw.length > cap ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => showMoreInStage(stage.id, stageRaw.length)}
                      >
                        Показать ещё ({stageRaw.length - cap})
                      </Button>
                    ) : null}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
