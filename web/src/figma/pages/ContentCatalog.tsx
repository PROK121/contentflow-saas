"use client";

import { motion } from "motion/react";
import {
  Film,
  Tv,
  Sparkles,
  Mic2,
  Globe,
  Clock,
  Star,
  Search,
  Filter,
  Plus,
  FileDown,
  Archive,
  ArchiveRestore,
  LayoutGrid,
  Table2,
  Trash2,
  CheckSquare,
  Square,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { v1Fetch } from "@/lib/v1-client";
import { tr } from "@/lib/i18n";
import { isAdminDeleteEmail } from "@/lib/admin-delete-email";
import { formatAssetTypeLabel } from "@/lib/asset-type-labels";
import { formatPlatformLabel } from "@/lib/catalog-item-create";
import { formatLicenseTermCell } from "@/lib/license-term-format";
import { Button } from "@/figma/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/figma/components/ui/alert-dialog";
import { Checkbox } from "@/figma/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/figma/components/ui/dialog";
import { cn } from "@/figma/components/ui/utils";

const ASSET_CHIPS: {
  id: string;
  label: string;
  icon?: typeof Film;
}[] = [
  { id: "all", label: tr("crm", "contentAll") },
  { id: "video", label: tr("crm", "contentFilms"), icon: Film },
  { id: "series", label: tr("crm", "contentSeries"), icon: Tv },
  {
    id: "animated_series",
    label: tr("crm", "contentAnimatedSeries"),
    icon: Tv,
  },
  {
    id: "animated_film",
    label: tr("crm", "contentAnimatedFilms"),
    icon: Film,
  },
  { id: "anime_series", label: tr("crm", "contentAnimeSeries"), icon: Sparkles },
  { id: "anime_film", label: tr("crm", "contentAnimeFilms"), icon: Sparkles },
  { id: "concert_show", label: tr("crm", "contentConcerts"), icon: Mic2 },
  { id: "archive", label: tr("crm", "contentArchive"), icon: Archive },
];

const typeIcons = {
  video: Film,
  series: Tv,
  animated_series: Tv,
  animated_film: Film,
  anime_series: Sparkles,
  anime_film: Sparkles,
  concert_show: Mic2,
} as const;

const demoGradients = [
  "linear-gradient(135deg, #4a8b83 0%, #69b0ac 100%)",
  "linear-gradient(135deg, #a3c95d 0%, #69b0ac 100%)",
  "linear-gradient(135deg, #69b0ac 0%, #4a8b83 100%)",
  "linear-gradient(135deg, #5c8f87 0%, #94b8b0 100%)",
];

const CONTENT_VIEW_STORAGE_KEY = "contentCatalogViewMode";

type CatalogViewMode = "grid" | "table";

function readStoredViewMode(): CatalogViewMode {
  if (typeof window === "undefined") return "grid";
  try {
    const v = window.localStorage.getItem(CONTENT_VIEW_STORAGE_KEY);
    return v === "table" ? "table" : "grid";
  } catch {
    return "grid";
  }
}

type LicenseTermRow = {
  territoryCode: string;
  startAt: string | null;
  endAt: string | null;
  durationMonths: number | null;
  exclusivity: string;
  platforms: string[];
};

type CatalogApiRow = {
  id: string;
  title: string;
  slug: string;
  assetType: string;
  status: string;
  updatedAt: string;
  posterFileName?: string | null;
  rightsHolder?: { id: string; legalName: string };
  licenseTerms?: LicenseTermRow[];
};

type GridItem = {
  id: string;
  title: string;
  type: string;
  status: string;
  updatedAt: string;
  owner: string;
  rightsHolderOrgId?: string;
  territory: string;
  duration: string;
  exclusive: boolean;
  platforms: string[];
  thumbnail: string;
  posterFileName: string | null;
  hasClosedSale: boolean;
};

const STATUS_LABEL: Record<string, string> = {
  draft: tr("crm", "contentStatusDraft"),
  active: tr("crm", "contentStatusActive"),
  archived: tr("crm", "contentStatusArchived"),
};

function CatalogTable(props: {
  items: GridItem[];
  renderRowActions: (item: GridItem) => ReactNode;
  selectedIds?: Set<string>;
  onToggle?: (id: string) => void;
  onSelectAll?: (ids: string[]) => void;
}) {
  const { items, renderRowActions, selectedIds, onToggle, onSelectAll } = props;
  if (!items.length) return null;
  const allSelected = items.length > 0 && items.every((i) => selectedIds?.has(i.id));
  const someSelected = !allSelected && items.some((i) => selectedIds?.has(i.id));
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
      <table className="w-full min-w-[880px] text-sm">
        <thead className="bg-muted/50 border-b-2 border-border">
          <tr>
            {onToggle && (
              <th className="px-4 py-3 w-10">
                <button
                  type="button"
                  aria-label="Выбрать все"
                  onClick={() =>
                    allSelected
                      ? items.forEach((i) => onToggle(i.id))
                      : onSelectAll?.(items.map((i) => i.id))
                  }
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  {allSelected ? (
                    <CheckSquare size={16} strokeWidth={2.5} />
                  ) : someSelected ? (
                    <CheckSquare size={16} strokeWidth={2.5} className="opacity-50" />
                  ) : (
                    <Square size={16} strokeWidth={2.5} />
                  )}
                </button>
              </th>
            )}
            <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide w-16">
              Обл.
            </th>
            <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide min-w-[200px]">
              Название
            </th>
            <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide">
              Тип
            </th>
            <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide">
              Статус
            </th>
            <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide min-w-[120px]">
              Территория
            </th>
            <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide min-w-[100px]">
              Срок
            </th>
            <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide min-w-[120px]">
              Платформы
            </th>
            <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide">
              Отметки
            </th>
            <th className="text-right px-4 py-3 text-xs font-bold uppercase tracking-wide w-[1%]">
              Действия
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const TypeIcon =
              typeIcons[item.type as keyof typeof typeIcons] ?? Film;
            const platLabels = item.platforms.map(formatPlatformLabel);
            const platStr =
              platLabels.length <= 3
                ? platLabels.join(", ")
                : `${platLabels.slice(0, 3).join(", ")} +${platLabels.length - 3}`;
            return (
              <tr
                key={item.id}
                className={cn(
                  "border-b border-border last:border-b-0 hover:bg-muted/25 transition-colors",
                  selectedIds?.has(item.id) && "bg-primary/5",
                )}
              >
                {onToggle && (
                  <td className="px-4 py-2 align-middle">
                    <button
                      type="button"
                      aria-label="Выбрать"
                      onClick={() => onToggle(item.id)}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {selectedIds?.has(item.id) ? (
                        <CheckSquare size={16} strokeWidth={2.5} className="text-primary" />
                      ) : (
                        <Square size={16} strokeWidth={2.5} />
                      )}
                    </button>
                  </td>
                )}
                <td className="px-4 py-2 align-middle">
                  {item.posterFileName ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/v1/catalog/items/${item.id}/poster?v=${encodeURIComponent(item.updatedAt)}`}
                      alt=""
                      className="w-11 h-[4.5rem] object-cover rounded-md border border-border bg-muted"
                      loading="lazy"
                    />
                  ) : (
                    <div
                      className="w-11 h-[4.5rem] rounded-md border border-border shadow-sm"
                      style={{ background: item.thumbnail }}
                    />
                  )}
                </td>
                <td className="px-4 py-3 align-top">
                  <Link
                    href={`/content/${item.id}`}
                    className="font-semibold text-foreground hover:text-primary hover:underline leading-snug"
                  >
                    {item.title}
                  </Link>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {item.owner}
                  </p>
                </td>
                <td className="px-4 py-3 align-top">
                  <div className="flex items-center gap-2">
                    <div className="rounded bg-muted p-1 text-muted-foreground shrink-0">
                      <TypeIcon size={14} strokeWidth={2.5} />
                    </div>
                    <span className="text-xs font-medium">
                      {formatAssetTypeLabel(item.type)}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 align-top">
                  <span className="rounded border border-border bg-muted/50 px-2 py-0.5 text-xs font-bold">
                    {STATUS_LABEL[item.status] ?? item.status}
                  </span>
                </td>
                <td className="px-4 py-3 align-top text-xs text-muted-foreground max-w-[160px]">
                  <span className="line-clamp-2">{item.territory}</span>
                </td>
                <td className="px-4 py-3 align-top text-xs text-muted-foreground whitespace-nowrap">
                  {item.duration}
                </td>
                <td className="px-4 py-3 align-top text-xs text-muted-foreground max-w-[180px]">
                  <span
                    className="line-clamp-2"
                    title={platLabels.join(", ")}
                  >
                    {platStr || "—"}
                  </span>
                </td>
                <td className="px-4 py-3 align-top">
                  <div className="flex flex-col gap-1 items-start">
                    {item.hasClosedSale ? (
                      <span className="rounded bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-700 ring-1 ring-amber-500/30 dark:text-amber-400">
                        Продажи
                      </span>
                    ) : null}
                    {item.exclusive ? (
                      <span className="inline-flex items-center gap-0.5 rounded bg-accent px-2 py-0.5 text-[10px] font-bold text-accent-foreground">
                        <Star size={10} fill="currentColor" strokeWidth={2.5} />
                        Исключит.
                      </span>
                    ) : null}
                    {!item.hasClosedSale && !item.exclusive ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : null}
                  </div>
                </td>
                <td className="px-4 py-3 align-top">
                  <div className="flex flex-wrap gap-1.5 justify-end">
                    <Link
                      href={`/deals?create=1&catalogItemId=${item.id}`}
                      className="rounded border border-border bg-card px-2.5 py-1.5 text-xs font-bold text-foreground shadow-sm transition-colors hover:bg-muted whitespace-nowrap"
                    >
                      Сделка
                    </Link>
                    <Link
                      href={`/content/${item.id}`}
                      className="rounded bg-primary px-2.5 py-1.5 text-xs font-bold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 whitespace-nowrap"
                    >
                      Подробнее
                    </Link>
                    {renderRowActions(item)}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function formatDuration(terms: LicenseTermRow[] | undefined): string {
  if (!terms?.length) return "—";
  const parts: string[] = [];
  for (const t of terms) {
    parts.push(
      formatLicenseTermCell(t.durationMonths, t.startAt, t.endAt),
    );
  }
  const uniq = [...new Set(parts)];
  return uniq.length ? uniq.join("; ") : "—";
}

function CatalogGridCard(props: {
  item: GridItem;
  index: number;
  tailSlot: ReactNode;
}) {
  const { item, index, tailSlot } = props;
  const TypeIcon = typeIcons[item.type as keyof typeof typeIcons] ?? Film;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="group flex flex-row rounded-lg bg-card border border-border overflow-hidden hover:shadow-lg transition-all duration-300 min-h-[200px]"
    >
      <div
        className={cn(
          "relative shrink-0 w-[min(36%,152px)] sm:w-40 md:w-44 self-stretch border-r border-border",
          item.posterFileName ? "bg-muted" : "",
        )}
      >
        <div className="flex h-full min-h-[200px] items-center justify-center p-2 sm:p-3">
          {item.posterFileName ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/v1/catalog/items/${item.id}/poster?v=${encodeURIComponent(item.updatedAt)}`}
              alt={item.title}
              loading="lazy"
              className="max-h-[min(280px,calc(100vh-12rem))] w-full max-w-full object-contain object-center rounded-md shadow-sm"
            />
          ) : (
            <div
              className="h-full min-h-[168px] w-full max-w-[9.5rem] rounded-md bg-cover bg-center shadow-sm"
              style={{ background: item.thumbnail }}
            />
          )}
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col p-4 sm:p-5">
        <div className="space-y-3">
          <div>
            <h3 className="mb-1 text-base font-semibold leading-snug text-foreground">
              {item.title}
            </h3>
            <p className="text-xs font-medium text-muted-foreground">
              {item.owner}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded bg-muted p-1.5 text-muted-foreground">
              <TypeIcon size={16} strokeWidth={2.5} />
            </div>
            <span className="rounded border border-border bg-muted/50 px-2.5 py-1 text-xs font-bold text-foreground">
              {formatAssetTypeLabel(item.type)}
            </span>
          </div>

          {(item.hasClosedSale || item.exclusive) && (
            <div className="flex flex-wrap gap-2">
              {item.hasClosedSale && (
                <span className="rounded bg-amber-500/15 px-2.5 py-1 text-xs font-bold text-amber-700 ring-1 ring-amber-500/30 dark:text-amber-400">
                  Продажи (закр. стадии)
                </span>
              )}
              {item.exclusive && (
                <span className="flex items-center gap-1 rounded bg-accent px-2.5 py-1 text-xs font-bold text-accent-foreground shadow-sm">
                  <Star size={11} fill="currentColor" strokeWidth={2.5} />
                  Исключительные права
                </span>
              )}
            </div>
          )}

          <div className="space-y-2 text-xs">
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="rounded bg-muted/50 p-1">
                <Globe size={12} strokeWidth={2.5} />
              </div>
              <span className="font-medium">{item.territory}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="rounded bg-muted/50 p-1">
                <Clock size={12} strokeWidth={2.5} />
              </div>
              <span className="font-medium">{item.duration}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {item.platforms.map((platform) => (
              <span
                key={platform}
                className="rounded border border-border bg-muted px-2.5 py-1 text-xs font-semibold text-foreground"
              >
                {formatPlatformLabel(platform)}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
          <span className="max-w-[55%] text-xs text-muted-foreground">
            Коммерция задаётся в сделке
          </span>
          <div className="flex flex-wrap justify-end gap-2">
            <Link
              href={`/deals?create=1&catalogItemId=${item.id}`}
              className="rounded border border-border bg-card px-3 py-2 text-xs font-bold text-foreground shadow-sm transition-colors hover:bg-muted"
            >
              Сделка
            </Link>
            <Link
              href={`/content/${item.id}`}
              className="rounded bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            >
              Подробнее
            </Link>
            {tailSlot}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export function ContentCatalog() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [selectedType, setSelectedType] = useState(() =>
    searchParams.get("tab") === "archive" ? "archive" : "all",
  );

  function selectLineFilter(nextId: string) {
    setSelectedType(nextId);
    const params = new URLSearchParams(searchParams.toString());
    if (nextId === "archive") params.set("tab", "archive");
    else params.delete("tab");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }
  const [searchQuery, setSearchQuery] = useState("");
  const [items, setItems] = useState<GridItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [soldSet, setSoldSet] = useState<Set<string>>(() => new Set());
  const [advOpen, setAdvOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterHolderId, setFilterHolderId] = useState<string>("");
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfErr, setPdfErr] = useState<string | null>(null);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [pdfModalSelectedIds, setPdfModalSelectedIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [archiveTarget, setArchiveTarget] = useState<GridItem | null>(null);
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [archiveErr, setArchiveErr] = useState<string | null>(null);
  const [restoreBusyId, setRestoreBusyId] = useState<string | null>(null);
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [deleteCatalogBusyId, setDeleteCatalogBusyId] = useState<string | null>(null);
  const canAdminDelete = isAdminDeleteEmail(authEmail);
  const [viewMode, setViewMode] = useState<CatalogViewMode>(() =>
    readStoredViewMode(),
  );

  // --- Bulk selection ---
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  function toggleSelectItem(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll(ids: string[]) {
    setSelectedIds(new Set(ids));
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function bulkArchive() {
    if (!selectedIds.size) return;
    setBulkBusy(true);
    setArchiveErr(null);
    try {
      await Promise.all(
        [...selectedIds].map((id) =>
          v1Fetch(`/catalog/items/${id}`, {
            method: "PATCH",
            body: JSON.stringify({ status: "archived" }),
          }),
        ),
      );
      clearSelection();
      await loadItems();
      selectLineFilter("archive");
    } catch (e) {
      setArchiveErr(e instanceof Error ? e.message : "Ошибка при архивировании");
    } finally {
      setBulkBusy(false);
    }
  }

  async function bulkDelete() {
    if (!selectedIds.size) return;
    if (
      !window.confirm(
        `Удалить ${selectedIds.size} позиций безвозвратно? Действие необратимо.`,
      )
    ) return;
    setBulkBusy(true);
    setArchiveErr(null);
    try {
      await Promise.all(
        [...selectedIds].map((id) =>
          v1Fetch(`/catalog/items/${id}`, { method: "DELETE" }),
        ),
      );
      clearSelection();
      await loadItems();
    } catch (e) {
      setArchiveErr(e instanceof Error ? e.message : "Ошибка при удалении");
    } finally {
      setBulkBusy(false);
    }
  }

  const setCatalogViewMode = useCallback((mode: CatalogViewMode) => {
    setViewMode(mode);
    try {
      window.localStorage.setItem(CONTENT_VIEW_STORAGE_KEY, mode);
    } catch {
      /* ignore */
    }
  }, []);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setLoadErr(null);
    try {
      const rows = await v1Fetch<CatalogApiRow[]>("/catalog/items");
      const mapped: GridItem[] = rows.map((i, idx) => ({
        id: i.id,
        title: i.title,
        type: i.assetType.toLowerCase(),
        status: i.status,
        updatedAt: i.updatedAt,
        owner: i.rightsHolder?.legalName ?? "—",
        rightsHolderOrgId: i.rightsHolder?.id,
        territory:
          i.licenseTerms?.map((l) => l.territoryCode).join(", ") || "—",
        duration: formatDuration(i.licenseTerms),
        exclusive:
          i.licenseTerms?.some((l) => l.exclusivity === "exclusive") ?? false,
        platforms: [
          ...new Set(
            (i.licenseTerms ?? []).flatMap((l) => l.platforms ?? []),
          ),
        ],
        thumbnail: demoGradients[idx % demoGradients.length],
        posterFileName:
          typeof i.posterFileName === "string" && i.posterFileName.trim()
            ? i.posterFileName.trim()
            : null,
        hasClosedSale: false,
      }));
      setItems(mapped);
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "Ошибка загрузки");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  useEffect(() => {
    void v1Fetch<{ user: { email: string } }>("/auth/me")
      .then((r) => setAuthEmail(r.user.email))
      .catch(() => setAuthEmail(null));
  }, []);

  useEffect(() => {
    const isArchiveUrl = searchParams.get("tab") === "archive";
    setSelectedType((prev) => {
      if (isArchiveUrl && prev !== "archive") return "archive";
      if (!isArchiveUrl && prev === "archive") return "all";
      return prev;
    });
  }, [searchParams]);

  useEffect(() => {
    if (!items.length) {
      setSoldSet(new Set());
      return;
    }
    void (async () => {
      try {
        const r = await v1Fetch<{ catalogItemIdsWithSales: string[] }>(
          "/deals/sold-hints",
          {
            method: "POST",
            body: JSON.stringify({
              catalogItemIds: items.map((i) => i.id),
            }),
          },
        );
        setSoldSet(new Set(r.catalogItemIdsWithSales ?? []));
      } catch {
        setSoldSet(new Set());
      }
    })();
  }, [items]);

  const itemsWithSold = useMemo(
    () =>
      items.map((i) => ({
        ...i,
        hasClosedSale: soldSet.has(i.id),
      })),
    [items, soldSet],
  );

  const rightsHolders = useMemo(() => {
    const m = new Map<string, string>();
    for (const i of itemsWithSold) {
      if (i.rightsHolderOrgId && i.owner !== "—") {
        m.set(i.rightsHolderOrgId, i.owner);
      }
    }
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [itemsWithSold]);

  const activeCatalogItems = useMemo(
    () => itemsWithSold.filter((i) => i.status !== "archived"),
    [itemsWithSold],
  );

  const archivedCatalogItems = useMemo(
    () => itemsWithSold.filter((i) => i.status === "archived"),
    [itemsWithSold],
  );

  const lineChipCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: activeCatalogItems.length,
    };
    for (const row of ASSET_CHIPS) {
      if (row.id === "all") continue;
      if (row.id === "archive") {
        counts.archive = archivedCatalogItems.length;
        continue;
      }
      counts[row.id] = activeCatalogItems.filter(
        (i) => i.type === row.id,
      ).length;
    }
    return counts;
  }, [activeCatalogItems, archivedCatalogItems]);

  const filteredContent = useMemo(() => {
    if (selectedType === "archive") return [];
    return activeCatalogItems.filter((item) => {
      const matchesType =
        selectedType === "all" || item.type === selectedType;
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        item.title.toLowerCase().includes(q) ||
        item.owner.toLowerCase().includes(q) ||
        item.territory.toLowerCase().includes(q);
      const matchesStatus =
        !filterStatus || item.status === filterStatus;
      const matchesHolder =
        !filterHolderId || item.rightsHolderOrgId === filterHolderId;
      return (
        matchesType &&
        matchesSearch &&
        matchesStatus &&
        matchesHolder
      );
    });
  }, [
    activeCatalogItems,
    selectedType,
    searchQuery,
    filterStatus,
    filterHolderId,
  ]);

  const filteredArchived = useMemo(() => {
    if (selectedType !== "archive") return [];
    return itemsWithSold.filter((item) => {
      if (item.status !== "archived") return false;
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        item.title.toLowerCase().includes(q) ||
        item.owner.toLowerCase().includes(q) ||
        item.territory.toLowerCase().includes(q);
      const matchesHolder =
        !filterHolderId || item.rightsHolderOrgId === filterHolderId;
      return matchesSearch && matchesHolder;
    });
  }, [itemsWithSold, selectedType, searchQuery, filterHolderId]);

  function openBuyerPdfModal() {
    setPdfErr(null);
    if (!filteredContent.length) {
      setPdfErr(
        "Нет позиций по текущим фильтрам — измените фильтры и откройте окно снова.",
      );
      return;
    }
    setPdfModalSelectedIds(new Set(filteredContent.map((i) => i.id)));
    setPdfModalOpen(true);
  }

  function togglePdfModalItem(id: string) {
    setPdfModalSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function confirmBuyerCatalogPdf() {
    if (!pdfModalSelectedIds.size) return;
    setPdfLoading(true);
    setPdfErr(null);
    try {
      const body: Record<string, unknown> = {
        catalogItemIds: [...pdfModalSelectedIds],
      };
      if (searchQuery.trim()) body.q = searchQuery.trim();
      if (selectedType !== "all" && selectedType !== "archive") {
        body.assetType = selectedType;
      }
      if (filterStatus) body.status = filterStatus;
      if (filterHolderId) body.rightsHolderOrgId = filterHolderId;

      const res = await fetch("/v1/catalog/export/buyer-catalog.pdf", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const a = document.createElement("a");
      const objectUrl = URL.createObjectURL(blob);
      a.href = objectUrl;
      a.download = `growix-katalog-${new Date().toISOString().slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(objectUrl);
      setPdfModalOpen(false);
    } catch (e) {
      setPdfErr(
        e instanceof Error ? e.message : "Не удалось сформировать PDF",
      );
    } finally {
      setPdfLoading(false);
    }
  }

  async function confirmSendToArchive() {
    if (!archiveTarget) return;
    setArchiveBusy(true);
    setArchiveErr(null);
    try {
      await v1Fetch(`/catalog/items/${archiveTarget.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "archived" }),
      });
      setArchiveTarget(null);
      await loadItems();
      selectLineFilter("archive");
    } catch (e) {
      setArchiveErr(
        e instanceof Error ? e.message : "Не удалось отправить в архив",
      );
    } finally {
      setArchiveBusy(false);
    }
  }

  async function restoreFromArchive(item: GridItem) {
    setRestoreBusyId(item.id);
    setArchiveErr(null);
    try {
      await v1Fetch(`/catalog/items/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "draft" }),
      });
      await loadItems();
      selectLineFilter("all");
    } catch (e) {
      setArchiveErr(
        e instanceof Error ? e.message : "Не удалось восстановить из архива",
      );
    } finally {
      setRestoreBusyId(null);
    }
  }

  async function deleteCatalogItemForever(item: GridItem) {
    if (
      !window.confirm(
        "Удалить единицу каталога безвозвратно? Действие необратимо.",
      )
    ) {
      return;
    }
    setDeleteCatalogBusyId(item.id);
    setArchiveErr(null);
    try {
      await v1Fetch(`/catalog/items/${item.id}`, { method: "DELETE" });
      await loadItems();
    } catch (e) {
      setArchiveErr(
        e instanceof Error ? e.message : "Не удалось удалить",
      );
    } finally {
      setDeleteCatalogBusyId(null);
    }
  }

  useEffect(() => {
    if (!pdfModalOpen) return;
    const vis = new Set(filteredContent.map((i) => i.id));
    setPdfModalSelectedIds((prev) => {
      const next = new Set<string>();
      for (const id of prev) {
        if (vis.has(id)) next.add(id);
      }
      return next;
    });
  }, [pdfModalOpen, filteredContent]);

  function renderFilterBar(counts: Record<string, number>) {
    return (
      <>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              size={18}
            />
            <input
              type="text"
              placeholder={tr("crm", "contentSearchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-md border border-border/50 bg-input-background pl-10 pr-4 py-2.5 text-sm focus:outline-none focus-visible:border-ring/80 focus-visible:ring-2 focus-visible:ring-ring/25"
            />
          </div>
          <button
            type="button"
            onClick={() => setAdvOpen((v) => !v)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 border rounded transition-colors text-sm font-medium",
              advOpen
                ? "bg-primary/10 border-primary/40 text-foreground"
                : "bg-card border-border hover:bg-muted/30",
            )}
          >
            <Filter size={18} />
            <span>{tr("crm", "contentAdvancedFilters")}</span>
          </button>
        </div>

        {advOpen && (
          <div className="flex flex-wrap gap-4 rounded-lg border border-border bg-card p-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                {tr("crm", "contentFilterStatus")}
              </label>
              <select
                className="rounded-md border border-border/50 bg-input-background px-3 py-2 text-sm min-w-[160px]"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="">{tr("crm", "paymentsFilterAll")}</option>
                <option value="draft">{tr("crm", "contentStatusDraft")}</option>
                <option value="active">{tr("crm", "contentStatusActive")}</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                {tr("crm", "contentFilterHolder")}
              </label>
              <select
                className="rounded-md border border-border/50 bg-input-background px-3 py-2 text-sm min-w-[200px]"
                value={filterHolderId}
                onChange={(e) => setFilterHolderId(e.target.value)}
              >
                <option value="">{tr("crm", "paymentsFilterAll")}</option>
                {rightsHolders.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                type="button"
                className="text-sm text-primary font-medium underline-offset-4 hover:underline"
                onClick={() => {
                  setFilterStatus("");
                  setFilterHolderId("");
                }}
              >
                {tr("crm", "contentReset")}
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {ASSET_CHIPS.map((type, index) => {
            const Icon = type.icon;
            const isActive = selectedType === type.id;
            const count = counts[type.id] ?? 0;
            return (
              <motion.button
                key={type.id}
                type="button"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.03 }}
                onClick={() => selectLineFilter(type.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded text-sm font-semibold transition-all ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-card border border-border hover:bg-muted/30"
                }`}
              >
                {Icon && <Icon size={16} strokeWidth={2.5} />}
                <span>{type.label}</span>
                <span
                  className={`px-2 py-0.5 rounded text-xs font-bold ${
                    isActive
                      ? "bg-white/20 text-white"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {loading && !loadErr ? "…" : count}
                </span>
              </motion.button>
            );
          })}
        </div>
      </>
    );
  }

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-2"
      >
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-1">
            {tr("crm", "contentTitle")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {tr("crm", "contentSubtitle")}
          </p>
        </div>
      </motion.div>

      {pdfErr && !pdfModalOpen ? (
        <p className="text-sm text-destructive whitespace-pre-wrap">{pdfErr}</p>
      ) : null}

      {loadErr && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 space-y-2">
          <p className="text-sm text-destructive whitespace-pre-wrap">
            {loadErr}
          </p>
          <button
            type="button"
            onClick={() => void loadItems()}
            className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
          >
            {tr("crm", "contractsRetry")}
          </button>
        </div>
      )}

      {archiveErr && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3">
          <p className="text-sm text-destructive whitespace-pre-wrap">
            {archiveErr}
          </p>
          <button
            type="button"
            onClick={() => setArchiveErr(null)}
            className="mt-2 text-xs font-semibold text-muted-foreground underline-offset-4 hover:underline"
          >
            Скрыть
          </button>
        </div>
      )}

           {selectedType !== "archive" ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap gap-2 justify-end"
        >
          <button
            type="button"
            disabled={pdfLoading || loading}
            onClick={openBuyerPdfModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-card border border-border text-foreground rounded hover:bg-muted transition-colors text-sm font-semibold shadow-sm disabled:opacity-50 disabled:pointer-events-none"
          >
            <FileDown size={18} strokeWidth={2.5} />
            <span>{tr("crm", "contentPdfForBuyer")}</span>
          </button>
          <Link
            href="/deals?create=1"
            className="flex items-center gap-2 px-4 py-2.5 bg-card border border-border text-foreground rounded hover:bg-muted transition-colors text-sm font-semibold shadow-sm"
          >
            <Plus size={18} strokeWidth={2.5} />
            <span>{tr("crm", "contentNewDealFromCatalog")}</span>
          </Link>
          <Link
            href="/content/new"
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors text-sm font-semibold shadow-sm"
          >
            <Plus size={18} strokeWidth={2.5} />
            <span>{tr("crm", "contentAdd")}</span>
          </Link>
        </motion.div>
      ) : null}

      <div className="space-y-6">
        {renderFilterBar(lineChipCounts)}

        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="text-xs text-muted-foreground mr-auto">
            {tr("crm", "contentViewLabel")}
          </span>
          <div className="inline-flex rounded-lg border border-border p-0.5 bg-muted/30">
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

        {selectedType === "archive" ? (
          <>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Позиции в архиве не в основном списке и не попадают в PDF по
              умолчанию. Восстановление возвращает статус «Черновик».
            </p>

            {loading && !loadErr && (
              <p className="text-sm text-muted-foreground">
                {tr("crm", "contentLoadingCatalog")}
              </p>
            )}

            {!loading && !loadErr && items.length === 0 && (
              <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-muted/20 py-14 text-center">
                <Film className="size-10 text-muted-foreground/40" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Каталог пуст</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">Добавьте первую позицию — фильм, сериал или другой контент</p>
                </div>
              </div>
            )}

            {!loading &&
              !loadErr &&
              items.length > 0 &&
              archivedCatalogItems.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Архив пуст. Выберите в строке выше «Фильмы», «Сериалы» и т.д.,
                  откройте карточку и нажмите «В архив».
                </p>
              )}

            {!loading &&
              !loadErr &&
              archivedCatalogItems.length > 0 &&
              filteredArchived.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Ничего не найдено по фильтрам. Сбросьте поиск или фильтры.
                </p>
              )}

            {viewMode === "grid" ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
                {filteredArchived.map((item, index) => (
                  <CatalogGridCard
                    key={item.id}
                    item={item}
                    index={index}
                    tailSlot={
                      <span className="inline-flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={restoreBusyId !== null}
                          onClick={() => void restoreFromArchive(item)}
                          className="inline-flex items-center justify-center gap-1 rounded border border-border bg-card px-3 py-2 text-xs font-bold text-foreground shadow-sm transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
                        >
                          <ArchiveRestore size={14} strokeWidth={2.5} />
                          {restoreBusyId === item.id
                            ? "Восстановление…"
                            : tr("crm", "contentRestore")}
                        </button>
                        {canAdminDelete ? (
                          <button
                            type="button"
                            disabled={deleteCatalogBusyId !== null}
                            onClick={() => void deleteCatalogItemForever(item)}
                            className="inline-flex items-center justify-center gap-1 rounded border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs font-bold text-destructive shadow-sm transition-colors hover:bg-destructive/15 disabled:pointer-events-none disabled:opacity-50"
                          >
                            <Trash2 size={14} strokeWidth={2.5} />
                            {deleteCatalogBusyId === item.id
                              ? "Удаление…"
                              : tr("crm", "contractsDelete")}
                          </button>
                        ) : null}
                      </span>
                    }
                  />
                ))}
              </div>
            ) : (
              <CatalogTable
                items={filteredArchived}
                selectedIds={selectedIds}
                onToggle={toggleSelectItem}
                onSelectAll={selectAll}
                renderRowActions={(item) => (
                  <span className="inline-flex flex-wrap gap-1.5 justify-end">
                    <button
                      type="button"
                      disabled={restoreBusyId !== null}
                      onClick={() => void restoreFromArchive(item)}
                      className="inline-flex items-center justify-center gap-1 rounded border border-border bg-card px-2.5 py-1.5 text-xs font-bold text-foreground shadow-sm transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50 whitespace-nowrap"
                    >
                      <ArchiveRestore size={14} strokeWidth={2.5} />
                      {restoreBusyId === item.id
                        ? "Восстановление…"
                        : tr("crm", "contentRestore")}
                    </button>
                    {canAdminDelete ? (
                      <button
                        type="button"
                        disabled={deleteCatalogBusyId !== null}
                        onClick={() => void deleteCatalogItemForever(item)}
                        className="inline-flex items-center justify-center gap-1 rounded border border-destructive/40 bg-destructive/10 px-2.5 py-1.5 text-xs font-bold text-destructive shadow-sm transition-colors hover:bg-destructive/15 disabled:pointer-events-none disabled:opacity-50 whitespace-nowrap"
                      >
                        <Trash2 size={14} strokeWidth={2.5} />
                        {deleteCatalogBusyId === item.id
                          ? "…"
                          : tr("crm", "contractsDelete")}
                      </button>
                    ) : null}
                  </span>
                )}
              />
            )}
          </>
        ) : (
          <>
            {loading && !loadErr && (
              <p className="text-sm text-muted-foreground">
                {tr("crm", "contentLoadingCatalog")}
              </p>
            )}

            {!loading && !loadErr && items.length === 0 && (
              <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-muted/20 py-14 text-center">
                <Film className="size-10 text-muted-foreground/40" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Каталог пуст</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">Добавьте первую позицию — фильм, сериал или другой контент</p>
                </div>
              </div>
            )}

            {!loading &&
              !loadErr &&
              items.length > 0 &&
              filteredContent.length === 0 &&
              (archivedCatalogItems.length > 0 ? (
                <p className="text-sm text-muted-foreground">
                  В каталоге по фильтрам ничего нет — переключитесь на чип
                  «Архив» в конце строки или сбросьте фильтры.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Ничего не найдено по фильтрам. Сбросьте поиск или фильтры.
                </p>
              ))}

            {viewMode === "grid" ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
                {filteredContent.map((item, index) => (
                  <CatalogGridCard
                    key={item.id}
                    item={item}
                    index={index}
                    tailSlot={
                      <button
                        type="button"
                        onClick={() => {
                          setArchiveErr(null);
                          setArchiveTarget(item);
                        }}
                        className="inline-flex items-center justify-center gap-1 rounded border border-border bg-card px-3 py-2 text-xs font-bold text-foreground shadow-sm transition-colors hover:bg-muted"
                      >
                        <Archive size={14} strokeWidth={2.5} />
                        {tr("crm", "contentToArchive")}
                      </button>
                    }
                  />
                ))}
              </div>
            ) : (
              <CatalogTable
                items={filteredContent}
                selectedIds={selectedIds}
                onToggle={toggleSelectItem}
                onSelectAll={selectAll}
                renderRowActions={(item) => (
                  <button
                    type="button"
                    onClick={() => {
                      setArchiveErr(null);
                      setArchiveTarget(item);
                    }}
                    className="inline-flex items-center justify-center gap-1 rounded border border-border bg-card px-2.5 py-1.5 text-xs font-bold text-foreground shadow-sm transition-colors hover:bg-muted whitespace-nowrap"
                  >
                    <Archive size={14} strokeWidth={2.5} />
                    {tr("crm", "contentToArchive")}
                  </button>
                )}
              />
            )}
          </>
        )}
      </div>

      <Dialog
        open={pdfModalOpen}
        onOpenChange={(open) => {
          setPdfModalOpen(open);
          if (!open) setPdfErr(null);
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[min(90vh,820px)] flex flex-col gap-0 p-0 overflow-hidden">
          <div className="p-6 pb-4 border-b border-border space-y-2">
            <DialogHeader className="space-y-2 text-left">
              <DialogTitle>{tr("crm", "contentPdfForBuyer")}</DialogTitle>
              <DialogDescription>
                Выберите тайтлы для включения в PDF. Список соответствует
                текущим фильтрам страницы ({filteredContent.length}{" "}
                {filteredContent.length === 1 ? "позиция" : "позиций"}).
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setPdfModalSelectedIds(
                    new Set(filteredContent.map((i) => i.id)),
                  )
                }
              >
                {tr("crm", "contentSelectAll")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setPdfModalSelectedIds(new Set())}
              >
                {tr("crm", "contentDeselect")}
              </Button>
              <span className="text-sm text-muted-foreground self-center">
                {tr("crm", "contentSelected")}: {pdfModalSelectedIds.size}
              </span>
            </div>
          </div>

          <div className="px-6 overflow-y-auto flex-1 min-h-0 max-h-[min(52vh,420px)] py-3 space-y-2">
            {filteredContent.map((item) => {
              const cid = `pdf-modal-${item.id}`;
              return (
                <div
                  key={item.id}
                  className="flex items-start gap-3 rounded-lg border border-border px-3 py-2.5 hover:bg-muted/30 transition-colors"
                >
                  <Checkbox
                    id={cid}
                    className="mt-0.5"
                    checked={pdfModalSelectedIds.has(item.id)}
                    onCheckedChange={() => togglePdfModalItem(item.id)}
                  />
                  <div className="min-w-0 flex-1">
                    <label
                      htmlFor={cid}
                      className="text-sm font-medium text-foreground cursor-pointer leading-snug block"
                    >
                      {item.title}
                    </label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatAssetTypeLabel(item.type)} · {item.owner} ·{" "}
                      {STATUS_LABEL[item.status] ?? item.status}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {pdfErr ? (
            <p className="px-6 text-sm text-destructive whitespace-pre-wrap">
              {pdfErr}
            </p>
          ) : null}

          <DialogFooter className="p-6 pt-4 border-t border-border bg-muted/20">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPdfModalOpen(false)}
              disabled={pdfLoading}
            >
              {tr("crm", "contractsCancel")}
            </Button>
            <Button
              type="button"
              disabled={!pdfModalSelectedIds.size || pdfLoading}
              onClick={() => void confirmBuyerCatalogPdf()}
            >
              {pdfLoading
                ? tr("crm", "contentGeneratingPdf")
                : tr("crm", "contentGeneratePdf")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Floating bulk action bar */}
      {selectedIds.size > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-xl border border-border bg-card px-5 py-3 shadow-xl"
        >
          <span className="text-sm font-bold text-foreground">
            {selectedIds.size} выбрано
          </span>
          <div className="h-5 w-px bg-border" />
          <button
            type="button"
            disabled={bulkBusy}
            onClick={() => void bulkArchive()}
            className="flex items-center gap-1.5 rounded border border-border bg-muted px-3 py-1.5 text-xs font-bold text-foreground hover:bg-muted/70 disabled:opacity-50 disabled:pointer-events-none transition-colors"
          >
            <Archive size={14} strokeWidth={2.5} />
            {tr("crm", "contentToArchive")}
          </button>
          {canAdminDelete && (
            <button
              type="button"
              disabled={bulkBusy}
              onClick={() => void bulkDelete()}
              className="flex items-center gap-1.5 rounded border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs font-bold text-destructive hover:bg-destructive/20 disabled:opacity-50 disabled:pointer-events-none transition-colors"
            >
              <Trash2 size={14} strokeWidth={2.5} />
              {tr("crm", "contractsDelete")}
            </button>
          )}
          <button
            type="button"
            onClick={clearSelection}
            className="ml-1 rounded p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label={tr("crm", "contentDeselect")}
          >
            <X size={16} strokeWidth={2.5} />
          </button>
        </motion.div>
      )}

      <AlertDialog
        open={archiveTarget !== null}
        onOpenChange={(open) => {
          if (!open) setArchiveTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Отправить «{archiveTarget?.title ?? ""}» в архив?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Карточка скроется из основного каталога. Данные, лицензии и постер
              сохранятся; восстановить можно в разделе «Архив» или на странице
              карточки.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archiveBusy}>Отмена</AlertDialogCancel>
            <Button
              type="button"
              disabled={archiveBusy}
              onClick={() => void confirmSendToArchive()}
            >
              {archiveBusy
                ? tr("crm", "contentSaving")
                : tr("crm", "contentToArchive")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
