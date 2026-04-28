"use client";

import { toast } from "sonner";
import { motion } from "motion/react";
import { formatMoneyAmount } from "@/lib/format-money";
import { isAdminDeleteEmail } from "@/lib/admin-delete-email";
import {
  Archive,
  ArchiveRestore,
  FileText,
  FilePenLine,
  Download,
  Eye,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  Plus,
  Search,
  LayoutGrid,
  Table2,
  FileDown,
  Ban,
  Send,
  Trash2,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { v1Fetch, v1DownloadFile } from "@/lib/v1-client";
import { tr } from "@/lib/i18n";
import { Button } from "@/figma/components/ui/button";
import { Input } from "@/figma/components/ui/input";
import { Label } from "@/figma/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/figma/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/figma/components/ui/dialog";
import { cn } from "@/figma/components/ui/utils";

const CONTRACT_VIEW_KEY = "contractsViewMode";

type ViewMode = "grid" | "table";

function readViewMode(): ViewMode {
  if (typeof window === "undefined") return "grid";
  try {
    return window.localStorage.getItem(CONTRACT_VIEW_KEY) === "table"
      ? "table"
      : "grid";
  } catch {
    return "grid";
  }
}

const CONTRACT_STATUS: Record<
  string,
  {
    label: string;
    color: string;
    icon: typeof FileText;
  }
> = {
  draft: {
    label: tr("crm", "contractsStatusDraft"),
    color: "bg-muted/50 text-muted-foreground border border-border",
    icon: FileText,
  },
  sent: {
    label: tr("crm", "contractsStatusSent"),
    color: "bg-warning/15 text-warning border border-warning/30",
    icon: Send,
  },
  signed: {
    label: tr("crm", "contractsStatusSigned"),
    color: "bg-success/15 text-success border border-success/30",
    icon: CheckCircle,
  },
  expired: {
    label: tr("crm", "contractsStatusExpired"),
    color: "bg-destructive/15 text-destructive border border-destructive/30",
    icon: Ban,
  },
};

type ContractApiRow = {
  id: string;
  dealId: string;
  number: string;
  templateId?: string | null;
  status: string;
  territory: string;
  termEndAt: string;
  amount: string;
  currency: string;
  signingDueAt?: string | null;
  archived?: boolean;
  updatedAt: string;
  clientCabinetSigned?: boolean;
  cabinetSignedAt?: string | null;
  sourceContractId?: string | null;
  deal: {
    id: string;
    title: string;
    buyer?: { legalName: string };
  };
};

type VersionRow = { version: number };

type DealOption = { id: string; title: string; currency: string; kind: string };

type ContractCreateKind = "po" | "platform";

/** Площадки для шаблона «контракт с площадкой» (уходит в templateId на API). */
const CONTRACT_PLATFORM_OTT: { key: string; label: string }[] = [
  { key: "kinopoisk", label: "Кинопоиск" },
  { key: "unico", label: "Юнико" },
  { key: "ivi", label: "ИВИ" },
  { key: "khabar", label: "Хабар" },
  { key: "channel7", label: "7 канал" },
  { key: "freedom", label: "Фридом" },
  { key: "tvplus", label: "ТВ+" },
];

import { fmtDate } from "@/lib/format-date";

export function Contracts() {
  const router = useRouter();
  const [rows, setRows] = useState<ContractApiRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [contractsTab, setContractsTab] = useState<"active" | "signed" | "archive">(
    "active",
  );
  const [contractKindTab, setContractKindTab] = useState<"po" | "platform">("po");
  const [archiveBusyId, setArchiveBusyId] = useState<string | null>(null);
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [deleteContractBusyId, setDeleteContractBusyId] = useState<string | null>(null);
  const [confirmDeleteContractId, setConfirmDeleteContractId] = useState<string | null>(null);
  const canAdminDelete = isAdminDeleteEmail(authEmail);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [createOpen, setCreateOpen] = useState(false);
  const [createKind, setCreateKind] = useState<ContractCreateKind>("po");
  const [createPlatformKey, setCreatePlatformKey] = useState(
    CONTRACT_PLATFORM_OTT[0]?.key ?? "",
  );
  const [dealsOptions, setDealsOptions] = useState<DealOption[]>([]);
  const [createDealId, setCreateDealId] = useState("");
  const [createDealIds, setCreateDealIds] = useState<string[]>([]);
  const [createBusy, setCreateBusy] = useState(false);
  const [createErr, setCreateErr] = useState<string | null>(null);
  const [dlBusyId, setDlBusyId] = useState<string | null>(null);

  useEffect(() => {
    setViewMode(readViewMode());
  }, []);

  useEffect(() => {
    void v1Fetch<{ user: { email: string } }>("/auth/me")
      .then((r) => setAuthEmail(r.user.email))
      .catch(() => setAuthEmail(null));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(searchQuery.trim()), 350);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const setCatalogViewMode = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    try {
      window.localStorage.setItem(CONTRACT_VIEW_KEY, mode);
    } catch {
      /* ignore */
    }
  }, []);

  const loadContracts = useCallback(async () => {
    setLoading(true);
    setLoadErr(null);
    try {
      const params = new URLSearchParams();
      params.set("limit", "200");
      if (debouncedQ) params.set("q", debouncedQ);
      if (contractsTab === "archive") params.set("archivedOnly", "true");
      if (contractsTab === "signed") params.set("signedOnly", "true");
      const list = await v1Fetch<ContractApiRow[]>(
        `/contracts?${params.toString()}`,
      );
      setRows(list);
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "Ошибка загрузки");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedQ, contractsTab]);

  async function setContractArchived(id: string, archived: boolean) {
    setArchiveBusyId(id);
    try {
      await v1Fetch(`/contracts/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ archived }),
      });
      toast.success(archived ? "Контракт перенесён в архив" : "Контракт восстановлен из архива");
      await loadContracts();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
      setLoadErr(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setArchiveBusyId(null);
    }
  }

  async function deleteContractForever(id: string) {
    setDeleteContractBusyId(id);
    try {
      await v1Fetch(`/contracts/${id}`, { method: "DELETE" });
      toast.success("Контракт удалён");
      await loadContracts();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка удаления");
      setLoadErr(e instanceof Error ? e.message : "Ошибка удаления");
    } finally {
      setDeleteContractBusyId(null);
    }
  }

  useEffect(() => {
    void loadContracts();
  }, [loadContracts]);

  useEffect(() => {
    if (contractsTab === "signed") setSelectedStatus(null);
  }, [contractsTab]);

  const kindScopedRows = useMemo(() => {
    return rows.filter((c) => {
      const isPlatform = (c.templateId ?? "").startsWith("contract-platform:");
      return contractKindTab === "platform" ? isPlatform : !isPlatform;
    });
  }, [rows, contractKindTab]);

  const filteredContracts = useMemo(() => {
    return kindScopedRows.filter((c) => {
      const matchesStatus =
        !selectedStatus || c.status === selectedStatus;
      return matchesStatus;
    });
  }, [kindScopedRows, selectedStatus]);

  const statusCounts = useMemo(() => {
    const acc: Record<string, number> = { all: kindScopedRows.length };
    for (const key of Object.keys(CONTRACT_STATUS)) {
      acc[key] = kindScopedRows.filter((c) => c.status === key).length;
    }
    return acc;
  }, [kindScopedRows]);

  async function openCreate(kind: ContractCreateKind) {
    setCreateKind(kind);
    if (kind === "platform" && CONTRACT_PLATFORM_OTT[0]) {
      setCreatePlatformKey(CONTRACT_PLATFORM_OTT[0].key);
    }
    setCreateErr(null);
    setCreateOpen(true);
    try {
      const d = await v1Fetch<DealOption[]>("/deals?limit=100");
      setDealsOptions(d);
      if (kind === "platform") {
        setCreateDealIds((prev) => prev.filter((id) => d.some((x) => x.id === id)));
      }
      if (d.length) {
        setCreateDealId((prev) =>
          prev && d.some((x) => x.id === prev) ? prev : d[0].id,
        );
      } else {
        setCreateDealId("");
      }
    } catch {
      setDealsOptions([]);
      setCreateDealId("");
    }
  }

  async function submitCreate() {
    if (createKind === "platform" && createDealIds.length === 0) {
      setCreateErr("Выберите хотя бы одну сделку");
      return;
    }
    if (createKind === "po" && !createDealId) {
      setCreateErr("Выберите сделку");
      return;
    }
    if (createKind === "platform" && !createPlatformKey.trim()) {
      setCreateErr("Выберите площадку");
      return;
    }
    setCreateBusy(true);
    setCreateErr(null);
    try {
      const templateId =
        createKind === "po"
          ? "contract-po"
          : `contract-platform:${createPlatformKey.trim()}`;
      const primaryDealId =
        createKind === "platform" ? createDealIds[0] : createDealId;
      const created = await v1Fetch<{ id: string }>("/contracts", {
        method: "POST",
        body: JSON.stringify({
          dealId: primaryDealId,
          dealIds: createKind === "platform" ? createDealIds : undefined,
          templateId,
        }),
      });
      setCreateOpen(false);
      toast.success("Контракт создан");
      router.push(`/contracts/${created.id}`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось создать");
      setCreateErr(e instanceof Error ? e.message : "Не удалось создать");
    } finally {
      setCreateBusy(false);
    }
  }

  async function downloadLatest(contractId: string) {
    setDlBusyId(contractId);
    try {
      const vs = await v1Fetch<VersionRow[]>(
        `/contracts/${contractId}/versions`,
      );
      if (!vs.length) {
        setLoadErr("У контракта пока нет версий PDF");
        return;
      }
      const latest = vs[0];
      await v1DownloadFile(
        `/contracts/${contractId}/versions/${latest.version}/download`,
        `contract-v${latest.version}.pdf`,
      );
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "Ошибка скачивания");
    } finally {
      setDlBusyId(null);
    }
  }

  const exportCsv = useCallback(() => {
    const head = [
      "number",
      "status",
      "deal",
      "buyer",
      "territory",
      "termEnd",
      "amount",
      "currency",
      "updatedAt",
    ];
    const lines = filteredContracts.map((c) =>
      [
        c.number,
        c.status,
        c.deal?.title ?? "",
        c.deal?.buyer?.legalName ?? "",
        c.territory,
        c.termEndAt,
        c.amount,
        c.currency,
        c.updatedAt,
      ]
        .map((x) => `"${String(x).replace(/"/g, '""')}"`)
        .join(","),
    );
    const blob = new Blob([head.join(",") + "\n" + lines.join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `contracts-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [filteredContracts]);

  return (
    <div className="space-y-6">
      <AlertDialog open={!!confirmDeleteContractId} onOpenChange={(v) => { if (!v) setConfirmDeleteContractId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить контракт навсегда?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие необратимо. Контракт и все его версии PDF будут удалены без возможности восстановления.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (confirmDeleteContractId) void deleteContractForever(confirmDeleteContractId); setConfirmDeleteContractId(null); }}
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-1">
            {tr("crm", "contractsTitle")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {tr("crm", "contractsSubtitle")}
          </p>
        </div>
        <div className="flex flex-row flex-nowrap items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 whitespace-nowrap"
            onClick={() => void exportCsv()}
            disabled={!filteredContracts.length}
          >
            <FileDown className="size-4 mr-1.5" />
            {tr("crm", "contractsExportCsv")}
          </Button>
          <Button
            type="button"
            size="sm"
            className="shrink-0 whitespace-nowrap"
            onClick={() => void openCreate("po")}
          >
            <Plus className="size-4 mr-1.5" />
            {tr("crm", "contractsCreatePo")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 whitespace-nowrap"
            onClick={() => void openCreate("platform")}
          >
            <Plus className="size-4 mr-1.5" />
            {tr("crm", "contractsCreatePlatform")}
          </Button>
        </div>
      </motion.div>

      {loadErr && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 space-y-2">
          <p className="text-sm text-destructive whitespace-pre-wrap">{loadErr}</p>
          <button
            type="button"
            onClick={() => {
              setLoadErr(null);
              void loadContracts();
            }}
            className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
          >
            {tr("crm", "contractsRetry")}
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setContractKindTab("po")}
          className={cn(
            "px-4 py-2 rounded font-semibold transition-all text-sm",
            contractKindTab === "po"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-card border border-border hover:bg-muted/30",
          )}
        >
          Контракты для ПО
        </button>
        <button
          type="button"
          onClick={() => setContractKindTab("platform")}
          className={cn(
            "px-4 py-2 rounded font-semibold transition-all text-sm",
            contractKindTab === "platform"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-card border border-border hover:bg-muted/30",
          )}
        >
          Контракты для площадки
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setContractsTab("active")}
          className={cn(
            "px-4 py-2 rounded font-semibold transition-all text-sm",
            contractsTab === "active"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-card border border-border hover:bg-muted/30",
          )}
        >
          {tr("crm", "contractsTabActive")}
        </button>
        <button
          type="button"
          onClick={() => setContractsTab("signed")}
          className={cn(
            "px-4 py-2 rounded font-semibold transition-all text-sm",
            contractsTab === "signed"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-card border border-border hover:bg-muted/30",
          )}
        >
          {tr("crm", "contractsTabSigned")}
        </button>
        <button
          type="button"
          onClick={() => setContractsTab("archive")}
          className={cn(
            "px-4 py-2 rounded font-semibold transition-all text-sm",
            contractsTab === "archive"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-card border border-border hover:bg-muted/30",
          )}
        >
          {tr("crm", "contractsTabArchive")}
        </button>
      </div>

      {contractsTab !== "signed" ? (
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setSelectedStatus(null)}
          className={cn(
            "px-4 py-2 rounded font-semibold transition-all text-sm",
            selectedStatus === null
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-card border border-border hover:bg-muted/30",
          )}
        >
          {tr("crm", "contractsFilterAll")}
          <span className="ml-2 px-2 py-0.5 rounded-full bg-current/20 text-xs font-bold">
            {statusCounts.all ?? 0}
          </span>
        </button>
        {Object.entries(CONTRACT_STATUS).map(([key, status]) => {
          const Icon = status.icon;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelectedStatus(key)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded font-semibold transition-all text-sm",
                selectedStatus === key
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-card border border-border hover:bg-muted/30",
              )}
            >
              <Icon size={14} strokeWidth={2.5} />
              {status.label}
              <span
                className={cn(
                  "px-2 py-0.5 rounded-full text-xs font-bold",
                  selectedStatus === key
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {statusCounts[key] ?? 0}
              </span>
            </button>
          );
        })}
      </div>
      ) : null}

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-xl">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            size={18}
          />
          <input
            type="text"
            placeholder={tr("crm", "contractsSearchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-md border border-border/50 bg-input-background pl-10 pr-4 py-2.5 text-sm focus:outline-none focus-visible:border-ring/80 focus-visible:ring-2 focus-visible:ring-ring/25"
          />
        </div>
        <div className="inline-flex rounded-lg border border-border p-0.5 bg-muted/30 shrink-0">
          <Button
            type="button"
            variant={viewMode === "grid" ? "secondary" : "ghost"}
            size="sm"
            className="h-8 gap-1.5 rounded-md"
            onClick={() => setCatalogViewMode("grid")}
          >
            <LayoutGrid className="size-4" strokeWidth={2.25} />
            {tr("crm", "contractsViewCards")}
          </Button>
          <Button
            type="button"
            variant={viewMode === "table" ? "secondary" : "ghost"}
            size="sm"
            className="h-8 gap-1.5 rounded-md"
            onClick={() => setCatalogViewMode("table")}
          >
            <Table2 className="size-4" strokeWidth={2.25} />
            {tr("crm", "contractsViewTable")}
          </Button>
        </div>
      </div>

      {loading && !loadErr && (
        <p className="text-sm text-muted-foreground">
          {tr("crm", "contractsLoading")}
        </p>
      )}

      {!loading && !loadErr && kindScopedRows.length === 0 && (
        <div className="rounded-lg border border-border bg-card p-8 text-center space-y-3">
          <p className="text-sm text-muted-foreground">
            {contractsTab === "archive"
              ? "В архиве пока нет контрактов."
              : contractsTab === "signed"
                ? "Здесь появятся подписанные контракты, которые клиент прикрепит в личном кабинете. Кабинет клиента подключается позже — список пока пуст."
                : "Контрактов пока нет. Создайте сделку в воронке и выпустите из неё черновик контракта."}
          </p>
            {contractsTab === "active" ? (
            <div className="flex flex-row flex-nowrap justify-center items-center gap-2">
              <Button
                type="button"
                asChild
                variant="outline"
                size="sm"
                className="shrink-0 whitespace-nowrap"
              >
                <Link href="/deals">К сделкам</Link>
              </Button>
              <Button
                type="button"
                size="sm"
                className="shrink-0 whitespace-nowrap"
                onClick={() => void openCreate("po")}
              >
                Создать контракт с ПО
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 whitespace-nowrap"
                onClick={() => void openCreate("platform")}
              >
                Создать контракт с Площадкой
              </Button>
            </div>
          ) : null}
        </div>
      )}

      {!loading &&
        !loadErr &&
        kindScopedRows.length > 0 &&
        filteredContracts.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-muted/20 py-10 text-center">
            <Search className="size-8 text-muted-foreground/50" />
            <p className="text-sm font-medium text-muted-foreground">
              Нет контрактов в выбранном статусе
            </p>
            <button
              type="button"
              className="text-xs text-primary hover:underline"
              onClick={() => setSelectedStatus(null)}
            >
              Сбросить фильтр статуса
            </button>
          </div>
        )}

      {viewMode === "grid" ? (
        <div className="space-y-4">
          {filteredContracts.map((contract, index) => {
            const status =
              CONTRACT_STATUS[contract.status] ?? CONTRACT_STATUS.draft;
            const StatusIcon = status.icon;

            return (
              <motion.div
                key={contract.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
                className="rounded-lg bg-card border border-border p-5 hover:shadow-md transition-all duration-300"
              >
                <div className="flex flex-col lg:flex-row lg:items-center gap-5">
                  <div className="flex-1 space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          {contract.clientCabinetSigned ? (
                            <FilePenLine size={16} className="text-primary shrink-0" strokeWidth={2.25} />
                          ) : null}
                          <span
                            className="text-xs font-bold text-muted-foreground"
                            style={{ fontFamily: "var(--font-mono)" }}
                          >
                            {contract.number}
                          </span>
                          {contract.clientCabinetSigned ? (
                            <span className="text-[10px] font-bold uppercase tracking-wide rounded bg-primary/15 text-primary px-2 py-0.5 ring-1 ring-primary/25">
                              Кабинет клиента
                            </span>
                          ) : null}
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold",
                              status.color,
                            )}
                          >
                            <StatusIcon size={11} strokeWidth={2.5} />
                            {status.label}
                          </span>
                        </div>
                        <h3 className="text-base font-bold mb-1 text-foreground">
                          <Link
                            href={`/deals/${contract.deal.id}`}
                            className="hover:text-primary hover:underline"
                          >
                            {contract.deal.title}
                          </Link>
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {contract.deal.buyer?.legalName ?? "—"}
                        </p>
                        {contract.sourceContractId ? (
                          <p className="text-xs text-muted-foreground mt-1">
                            Исходный контракт в CRM:{" "}
                            <span className="font-mono">
                              {contract.sourceContractId.slice(0, 8)}…
                            </span>
                          </p>
                        ) : null}
                        {contract.cabinetSignedAt ? (
                          <p className="text-xs text-muted-foreground mt-1">
                            Получено из кабинета:{" "}
                            {new Date(contract.cabinetSignedAt).toLocaleString("ru-RU")}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground font-semibold mb-1 uppercase tracking-wide">
                          Территория
                        </p>
                        <p className="font-semibold text-foreground">
                          {contract.territory}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground font-semibold mb-1 uppercase tracking-wide">
                          Окончание срока
                        </p>
                        <p className="font-semibold text-foreground">
                          {fmtDate(contract.termEndAt)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground font-semibold mb-1 uppercase tracking-wide">
                          Подписание
                        </p>
                        <p className="font-semibold text-foreground">
                          {fmtDate(contract.signingDueAt)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground font-semibold mb-1 uppercase tracking-wide">
                          Сумма
                        </p>
                        <p
                          className="font-bold text-foreground text-base"
                          style={{ fontFamily: "var(--font-mono)" }}
                        >
                          {formatMoneyAmount(contract.amount)}{" "}
                          {contract.currency}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex lg:flex-col gap-2 shrink-0">
                    <Button type="button" size="sm" asChild>
                      <Link href={`/contracts/${contract.id}`}>
                        <Eye size={14} strokeWidth={2.5} className="mr-1.5" />
                        {tr("crm", "contractsOpen")}
                      </Link>
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={dlBusyId === contract.id}
                      onClick={() => void downloadLatest(contract.id)}
                    >
                      {dlBusyId === contract.id
                        ? <Loader2 size={14} className="animate-spin mr-1.5" />
                        : <Download size={14} strokeWidth={2.5} className="mr-1.5" />}
                      {dlBusyId === contract.id
                        ? tr("crm", "contractsDownloading")
                        : tr("crm", "contractsDownloadPdf")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={archiveBusyId === contract.id}
                      onClick={() =>
                        void setContractArchived(
                          contract.id,
                          contractsTab === "active" || contractsTab === "signed",
                        )
                      }
                    >
                      {contractsTab === "active" || contractsTab === "signed" ? (
                        <Archive size={14} strokeWidth={2.5} className="mr-1.5" />
                      ) : (
                        <ArchiveRestore size={14} strokeWidth={2.5} className="mr-1.5" />
                      )}
                      {archiveBusyId === contract.id
                        ? "…"
                        : contractsTab === "active" || contractsTab === "signed"
                          ? tr("crm", "contractsToArchive")
                          : tr("crm", "contractsRestore")}
                    </Button>
                    {contractsTab === "archive" && canAdminDelete ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        disabled={deleteContractBusyId === contract.id}
                        onClick={() => setConfirmDeleteContractId(contract.id)}
                      >
                        <Trash2 size={14} strokeWidth={2.5} className="mr-1.5" />
                        {deleteContractBusyId === contract.id
                          ? "…"
                          : tr("crm", "contractsDelete")}
                      </Button>
                    ) : null}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-muted/50 border-b-2 border-border">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide">
                  Номер
                </th>
                <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide">
                  Статус
                </th>
                <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide min-w-[160px]">
                  Сделка
                </th>
                <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide">
                  Клиент
                </th>
                <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide">
                  Территория
                </th>
                <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide whitespace-nowrap">
                  Срок
                </th>
                <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide">
                  Сумма
                </th>
                <th className="text-right px-4 py-3 text-xs font-bold uppercase tracking-wide w-[1%]">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredContracts.map((contract) => {
                const status =
                  CONTRACT_STATUS[contract.status] ?? CONTRACT_STATUS.draft;
                const StatusIcon = status.icon;
                return (
                  <tr
                    key={contract.id}
                    className="border-b border-border last:border-b-0 hover:bg-muted/25"
                  >
                    <td
                      className="px-4 py-3 font-mono text-xs font-semibold"
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      <span className="inline-flex items-center gap-1.5 flex-wrap">
                        {contract.clientCabinetSigned ? (
                          <FilePenLine size={14} className="text-primary shrink-0" strokeWidth={2.25} />
                        ) : null}
                        {contract.number}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1 items-start">
                        {contract.clientCabinetSigned ? (
                          <span className="text-[10px] font-bold uppercase tracking-wide rounded bg-primary/15 text-primary px-1.5 py-0.5 ring-1 ring-primary/25">
                            Кабинет
                          </span>
                        ) : null}
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold",
                            status.color,
                          )}
                        >
                          <StatusIcon size={11} strokeWidth={2.5} />
                          {status.label}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/deals/${contract.deal.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {contract.deal.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {contract.deal.buyer?.legalName ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-xs max-w-[140px]">
                      <span className="line-clamp-2">{contract.territory}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {fmtDate(contract.termEndAt)}
                    </td>
                    <td
                      className="px-4 py-3 font-mono text-xs font-semibold whitespace-nowrap"
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      {formatMoneyAmount(contract.amount)} {contract.currency}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5 justify-end">
                        <Button type="button" variant="outline" size="sm" asChild>
                          <Link href={`/contracts/${contract.id}`}>
                            <Eye className="size-3.5 mr-1" />
                            Карточка
                          </Link>
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={dlBusyId === contract.id}
                          onClick={() => void downloadLatest(contract.id)}
                        >
                          <Download className="size-3.5 mr-1" />
                          PDF
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={archiveBusyId === contract.id}
                          onClick={() =>
                            void setContractArchived(
                              contract.id,
                              contractsTab === "active" || contractsTab === "signed",
                            )
                          }
                          aria-label={contractsTab === "active" || contractsTab === "signed" ? "В архив" : "Вернуть из архива"}
                          title={contractsTab === "active" || contractsTab === "signed" ? "В архив" : "Вернуть из архива"}
                        >
                          {contractsTab === "active" || contractsTab === "signed" ? (
                            <Archive className="size-3.5" />
                          ) : (
                            <ArchiveRestore className="size-3.5" />
                          )}
                        </Button>
                        {contractsTab === "archive" && canAdminDelete ? (
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            disabled={deleteContractBusyId === contract.id}
                            onClick={() => setConfirmDeleteContractId(contract.id)}
                            aria-label="Удалить контракт навсегда"
                            title="Удалить безвозвратно"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {createKind === "platform"
                ? tr("crm", "contractsCreateTitlePlatform")
                : tr("crm", "contractsCreateTitlePo")}
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Черновик создаётся по сделке: подтянется сумма из снимка сделки и
            состав контента.
            {createKind === "platform"
              ? " Укажите площадку (OTT) — данные попадут в шаблон контракта."
              : null}
          </p>
          <div className="space-y-2">
            <Label>{tr("crm", "contractsDealLabel")}</Label>
            {createKind === "platform" ? (
              <div className="max-h-44 overflow-y-auto rounded-md border border-border/50 bg-input-background p-2 text-sm">
                {dealsOptions.length === 0 ? (
                  <p className="px-1 py-1 text-xs text-muted-foreground">
                    Сделки не найдены
                  </p>
                ) : (
                  dealsOptions.map((d) => {
                    const checked = createDealIds.includes(d.id);
                    return (
                      <label
                        key={d.id}
                        className="flex items-center gap-2 px-1 py-1.5 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) =>
                            setCreateDealIds((prev) =>
                              e.target.checked
                                ? [...prev, d.id]
                                : prev.filter((id) => id !== d.id),
                            )
                          }
                        />
                        <span>
                          {d.title} ({d.kind === "purchase" ? "покупка" : "продажа"})
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            ) : (
              <select
                className="w-full rounded-md border border-border/50 bg-input-background px-3 py-2 text-sm"
                value={createDealId}
                onChange={(e) => setCreateDealId(e.target.value)}
              >
                <option value="">Выберите…</option>
                {dealsOptions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title} ({d.kind === "purchase" ? "покупка" : "продажа"})
                  </option>
                ))}
              </select>
            )}
            {createKind === "platform" ? (
              <p className="text-xs text-muted-foreground">
                Можно выбрать несколько сделок. Первая выбранная будет основной
                карточкой контракта.
              </p>
            ) : null}
          </div>
          {createKind === "platform" ? (
            <div className="space-y-2">
              <Label>{tr("crm", "contractsPlatformLabel")}</Label>
              <select
                className="w-full rounded-md border border-border/50 bg-input-background px-3 py-2 text-sm"
                value={createPlatformKey}
                onChange={(e) => setCreatePlatformKey(e.target.value)}
              >
                {CONTRACT_PLATFORM_OTT.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {createErr ? (
            <p className="text-sm text-destructive">{createErr}</p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              {tr("crm", "contractsCancel")}
            </Button>
            <Button
              type="button"
              disabled={createBusy}
              onClick={() => void submitCreate()}
            >
              {createBusy
                ? tr("crm", "contractsCreateBusy")
                : tr("crm", "contractsCreateAction")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
