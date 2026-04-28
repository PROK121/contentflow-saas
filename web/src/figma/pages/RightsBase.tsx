"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { v1Fetch } from "@/lib/v1-client";
import { formatAssetTypeLabel } from "@/lib/asset-type-labels";
import { formatMoneyAmount } from "@/lib/format-money";
import { tr } from "@/lib/i18n";
import {
  formatPremiereCategory,
  readCatalogOfferSourceMeta,
} from "@/lib/catalog-item-create";
import { DEAL_DOCUMENT_GROUPS } from "@/lib/deal-document-slots";
import {
  formatDealTerritoryCodes,
  dealTerritoryLabel,
} from "@/lib/deal-territory-presets";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/figma/components/ui/tabs";
import {
  MaterialRequest,
  MaterialRequestStatus,
  STATUS_LABEL,
  STATUS_TONE,
} from "@/lib/material-requests";

type CatalogItemRow = {
  id: string;
  title: string;
  slug: string;
  assetType: string;
  status: string;
  posterFileName?: string | null;
  metadata?: unknown;
  rightsHolder: { legalName: string };
  licenseTerms?: Array<{
    territoryCode: string;
    exclusivity: string;
    platforms: string[];
    languageRights: string[];
    startAt: string | null;
    endAt: string | null;
    durationMonths: number | null;
  }>;
};

type DealRow = {
  id: string;
  title: string;
  kind: string;
  stage: string;
  currency: string;
  archived?: boolean;
  commercialSnapshot?: {
    expectedValue?: unknown;
    vatIncluded?: boolean;
    signedAt?: string;
    effectiveAt?: string;
    paymentModel?: string;
    paymentTerms?: string;
    deliveryDeadline?: string;
    notes?: string;
    minimumGuarantee?: string;
  } | null;
  dealDocuments?: Record<string, unknown> | null;
  buyer: { id: string; legalName: string; country: string };
  catalogItems: Array<{
    catalogItemId: string;
    rightsSelection?: unknown;
    catalogItem: { id: string; title: string; slug: string };
  }>;
};

const CHAIN_REQUIRED_SLOTS =
  DEAL_DOCUMENT_GROUPS.find((g) => g.title.startsWith("Цепочка прав"))?.items.map(
    (x) => x.slot,
  ) ?? [];

type OrgRow = {
  id: string;
  legalName: string;
  country: string;
  type: string;
  metadata?: {
    primaryLanguages?: string;
    preferredGenres?: string;
    exclusivityReadiness?: string;
    preferredTerm?: string;
    averageBudget?: string;
    paymentDiscipline?: string;
    techRequirements?: string;
    contactName?: string;
    contactEmail?: string;
    contactPhone?: string;
    notes?: string;
  } | null;
};

type ContractRow = {
  id: string;
  dealId: string;
  number: string;
  status: string;
  territory: string;
  termEndAt: string;
  amount: string;
  currency: string;
};

const README_LINES = [
  "Что такое База прав?",
  "",
  "База прав — единый реестр всего контента компании и всех лицензионных сделок. Здесь фиксируется: какой контент есть, у кого куплен, кому продан, на каких условиях, за какие деньги и в каком состоянии находятся материалы для передачи покупателю.",
  "",
  "Зачем это нужно менеджеру?",
  "",
  "Без Базы прав невозможно быстро ответить: «Можем ли мы продать этот фильм на Казахстан?», «Не пересекается ли новая сделка с действующей?», «Когда истекают права?». База прав даёт полную картину одним взглядом.",
  "",
  "Структура раздела — 6 вкладок:",
  "",
  "1. Реестр тайтлов — полный список контента (фильмы, сериалы, документалки). Карточка на каждый тайтл со всеми техническими и правовыми характеристиками. Это отправная точка — без тайтла невозможно создать сделку.",
  "",
  "2. Сделки закупа — все договоры, по которым компания приобрела права у правообладателей (продюсеров, дистрибьюторов, студий). Что куплено, на каких территориях, на какой срок и сколько заплачено.",
  "",
  "3. Сделки продаж — все договоры, по которым компания продала (лицензировала) права покупателям: OTT-платформам, телеканалам, кинотеатрам. Что продано, кому, за сколько и на каких условиях.",
  "",
  "4. Площадки — справочник покупателей. Информация о платформах и каналах: контакты, предпочтения по жанрам, технические требования к материалам, платёжная дисциплина.",
  "",
  "5. Материалы — контроль готовности технических файлов по каждому тайтлу. Какие материалы уже есть (мастер-видео, субтитры, постер), а какие нужно получить от правообладателя перед передачей покупателю.",
  "",
  "6. Справочники — единый глоссарий терминов: типы прав (SVOD, AVOD, Pay TV...), форматы лицензии (эксклюзив, ко-эксклюзив...), модели оплаты, коды территорий и языков. Открывайте, когда сомневаетесь в значении термина.",
  "",
  "Что критически важно заполнять в каждой сделке:",
  "",
  "• Сроки начала и окончания прав — без них неизвестно, когда права истекают",
  "• Территория — определяет, где разрешено использовать контент",
  "• Языковые права — на каких языках разрешена озвучка и субтитры",
  "• Тип прав — SVOD, Pay TV, AVOD и т.д. (выбирается из Справочников)",
  "• Формат лицензии — эксклюзив или нет (влияет на возможность продать тем же правом другому)",
  "• Сумма сделки и модель оплаты — для финансового учёта",
  "• Статус договора — подписан / в работе / истёк",
] as const;

const DICTIONARIES = {
  rightsTypes: [
    ["SVOD", "Подписная модель видео по запросу"],
    ["AVOD", "Видео по запросу с рекламой"],
    ["TVOD", "Транзакционная модель VOD / аренда"],
    ["EST", "Покупка цифровой копии (buy-to-own)"],
    ["Free TV", "Бесплатное эфирное телевидение"],
    ["Pay TV", "Платные линейные телеканалы"],
    ["In-flight", "Бортовые системы развлечений (авиа)"],
    ["Rail", "Бортовые системы развлечений (ж/д)"],
    ["Non-theatrical", "Показы вне кинотеатров: отели, школы, мероприятия"],
  ] as const,
  exclusivity: [
    ["Эксклюзив", "Только один покупатель на территории/платформе"],
    ["Ко-эксклюзив", "Ограниченное число покупателей"],
    ["Неэксклюзив", "Можно лицензировать нескольким покупателям"],
    ["Оконный эксклюзив", "Эксклюзив только в заданное окно"],
    ["Холдбэк", "Отсрочка перед следующим способом использования"],
  ] as const,
  paymentModels: [
    ["Фиксированный платеж", "Разовый лицензионный платеж"],
    ["Минимальная гарантия", "Гарантированный авансовый платеж"],
    ["Ревенью-шер", "Процент от выручки"],
    ["Гибрид", "Фиксированный платеж + доля выручки"],
    ["За эпизод", "Оплата за каждый переданный эпизод"],
    ["Рассрочка", "Оплата траншами"],
    ["Бартер/промо", "Стоимость компенсируется промо-активностями"],
  ] as const,
  territories: [
    ["KZ", "Казахстан"],
    ["CIS", "СНГ"],
    ["WW", "Весь мир"],
    ["CA", "Центральная Азия"],
    ["RU", "Россия"],
    ["UZ", "Узбекистан"],
    ["KG", "Кыргызстан"],
    ["AZ", "Азербайджан"],
    ["TJ", "Таджикистан"],
    ["TM", "Туркменистан"],
  ] as const,
  languages: [
    ["RU", "Русский"],
    ["KZ", "Казахский"],
    ["EN", "Английский"],
    ["TR", "Турецкий"],
    ["AR", "Арабский"],
    ["ZH", "Китайский"],
    ["Прочее", "Прочее"],
  ] as const,
};

function titleId(item: CatalogItemRow): string {
  const s = item.slug?.trim();
  if (s) return `T-${s.slice(0, 24)}`;
  return `T-${item.id.slice(0, 8)}`;
}

function parseRs(raw: unknown): {
  territoryCodes: string[];
  startAt: string | null;
  endAt: string | null;
  exclusivity: string;
  platforms: string[];
  languageRights: string[];
  holdback: string | null;
} | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.territoryCodes)) return null;
  return {
    territoryCodes: o.territoryCodes.map((t) => String(t).toUpperCase()),
    startAt: typeof o.startAt === "string" ? o.startAt : null,
    endAt: typeof o.endAt === "string" ? o.endAt : null,
    exclusivity: String(o.exclusivity ?? ""),
    platforms: Array.isArray(o.platforms) ? o.platforms.map(String) : [],
    languageRights: Array.isArray(o.languageRights) ? o.languageRights.map(String) : [],
    holdback: typeof o.holdback === "string" ? o.holdback : null,
  };
}

function exclusivityTemplate(ex: string): string {
  switch (ex) {
    case "exclusive":
    case "sole":
      return "Эксклюзив";
    case "co_exclusive":
      return "Ко-эксклюзив";
    case "non_exclusive":
      return "Неэксклюзив";
    default:
      return ex || "—";
  }
}

function platformsToRightsAcquired(platforms: string[]): string {
  const map: Record<string, string> = {
    TV: "Платное ТВ",
    VOD: "SVOD",
    OTT: "SVOD",
    Web: "AVOD",
    YouTube: "AVOD",
    ShipIfec: "Бортовые права",
    PublicRights: "Публичные некинотеатральные права",
  };
  const parts = [...new Set(platforms.map((p) => map[p] ?? p))];
  return parts.join("; ") || "—";
}

function dealStageLabel(stage: string): string {
  switch (stage) {
    case "lead":
      return "Лид";
    case "negotiation":
      return "Переговоры";
    case "contract":
      return "Контракт";
    case "paid":
      return "Закрыто";
    default:
      return stage;
  }
}

/// Сводный статус по тайтлу: что вообще с материалами на этом тайтле.
/// Игнорируем отменённые/отклонённые запросы — они не влияют на готовность.
/// Возвращаем `null`, если по тайтлу никто ничего не запрашивал.
function aggregateMaterialStatus(
  reqs: readonly MaterialRequest[],
): MaterialRequestStatus | null {
  const active = reqs.filter(
    (r) => r.status !== "cancelled" && r.status !== "rejected",
  );
  if (active.length === 0) return null;
  if (active.some((r) => r.status === "pending")) return "pending";
  if (active.some((r) => r.status === "partial")) return "partial";
  if (active.every((r) => r.status === "complete")) return "complete";
  return "partial";
}

/// Статус конкретного слота (или группы слотов) для одного тайтла.
/// Учитывает все активные запросы и их аплоады. Возвращает строку,
/// которую сразу можно отрисовать в ячейке таблицы.
type SlotCellStatus = "approved" | "pending" | "rejected" | "requested" | "none";

function slotCellStatus(
  reqs: readonly MaterialRequest[],
  slotKeys: readonly string[],
): SlotCellStatus {
  const active = reqs.filter(
    (r) => r.status !== "cancelled" && r.status !== "rejected",
  );
  let requested = false;
  let pending = false;
  let rejected = false;
  let approved = false;
  for (const r of active) {
    if (!r.requestedSlots.some((s) => slotKeys.includes(s))) continue;
    requested = true;
    const ups = r.uploads.filter((u) => slotKeys.includes(u.slot));
    if (ups.some((u) => u.reviewStatus === "approved")) approved = true;
    if (ups.some((u) => u.reviewStatus === "pending")) pending = true;
    if (ups.some((u) => u.reviewStatus === "rejected")) rejected = true;
  }
  if (approved && !pending && !rejected) return "approved";
  if (approved) return "approved";
  if (pending) return "pending";
  if (rejected) return "rejected";
  if (requested) return "requested";
  return "none";
}

function SlotStatusCell({ status }: { status: SlotCellStatus }) {
  if (status === "none") {
    return <span className="text-muted-foreground">—</span>;
  }
  const map: Record<Exclude<SlotCellStatus, "none">, { label: string; tone: string }> = {
    approved: { label: "Готово", tone: "bg-emerald-50 text-emerald-700" },
    pending: { label: "На проверке", tone: "bg-amber-50 text-amber-700" },
    rejected: { label: "Отклонён", tone: "bg-red-50 text-red-700" },
    requested: { label: "Запрошено", tone: "bg-blue-50 text-blue-700" },
  };
  const { label, tone } = map[status];
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${tone}`}>
      {label}
    </span>
  );
}

function TableShell({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-border bg-card overflow-hidden ${className}`}
    >
      <div className="max-h-[min(70vh,720px)] overflow-auto">
        <table className="w-max min-w-full border-collapse text-sm">{children}</table>
      </div>
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={`sticky top-0 z-[1] border-b border-border bg-muted/90 px-2 py-2 text-left text-xs font-semibold whitespace-nowrap backdrop-blur-sm ${className}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className = "",
  title,
  colSpan,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
  colSpan?: number;
}) {
  return (
    <td
      className={`border-b border-border/60 px-2 py-1.5 text-xs text-foreground align-top ${className}`}
      title={title}
      colSpan={colSpan}
    >
      {children}
    </td>
  );
}

export function RightsBase() {
  const [catalog, setCatalog] = useState<CatalogItemRow[]>([]);
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [materialRequests, setMaterialRequests] = useState<MaterialRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [expiryDays, setExpiryDays] = useState<60 | 90 | 180 | null>(null);
  const [activeTab, setActiveTab] = useState("titles");

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const [cat, dls, org, ctr, mr] = await Promise.all([
        v1Fetch<CatalogItemRow[]>("/catalog/items"),
        v1Fetch<DealRow[]>("/deals"),
        v1Fetch<OrgRow[]>("/organizations?type=client"),
        v1Fetch<ContractRow[]>("/contracts?limit=200"),
        v1Fetch<MaterialRequest[]>("/material-requests").catch(() => [] as MaterialRequest[]),
      ]);
      setCatalog(cat.filter((c) => c.status !== "archived"));
      setDeals(dls.filter((x) => x.archived !== true));
      setOrgs(org);
      setContracts(ctr);
      setMaterialRequests(mr);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка загрузки");
      setCatalog([]);
      setDeals([]);
      setOrgs([]);
      setContracts([]);
      setMaterialRequests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const contractsByDealId = useMemo(() => {
    const m = new Map<string, ContractRow[]>();
    for (const c of contracts) {
      const arr = m.get(c.dealId) ?? [];
      arr.push(c);
      m.set(c.dealId, arr);
    }
    return m;
  }, [contracts]);

  // --- expiry filter ---
  const expiryThreshold = useMemo(() => {
    if (!expiryDays) return null;
    return Date.now() + expiryDays * 86_400_000;
  }, [expiryDays]);

  // --- CSV export ---
  function exportCsv(tab: string) {
    let headers: string[] = [];
    const rows: string[][] = [];

    if (tab === "titles") {
      headers = ["ID тайтла", "Оригинальное название", "Тип контента", "Правообладатель", "Год производства", "Страна"];
      for (const item of catalog) {
        const meta = readCatalogOfferSourceMeta(item.metadata);
        rows.push([
          titleId(item),
          item.title,
          formatAssetTypeLabel(item.assetType),
          item.rightsHolder.legalName,
          meta.productionYear?.trim() || "",
          meta.countryOfProduction?.trim() || "",
        ]);
      }
    } else if (tab === "acq") {
      headers = ["ID", "Тайтл", "Правообладатель", "Стадия", "Дата подписи", "Нач. лицензии", "Конец лицензии", "Территория", "Модель оплаты", "Сумма"];
      for (const deal of deals.filter((d) => d.kind === "purchase")) {
        for (const row of deal.catalogItems) {
          const rs = parseRs(row.rightsSelection);
          const tid = catalog.find((c) => c.id === row.catalogItemId);
          const t = tid ? titleId(tid) : row.catalogItemId.slice(0, 8);
          const snap = deal.commercialSnapshot ?? {};
          const ev = snap.expectedValue;
          const gross = typeof ev === "string" || typeof ev === "number" ? formatMoneyAmount(String(ev)) : "";
          rows.push([
            `A-${deal.id.slice(0, 8)}`,
            t,
            deal.buyer.legalName,
            dealStageLabel(deal.stage),
            snap.signedAt ? snap.signedAt.slice(0, 10) : "",
            rs?.startAt ? rs.startAt.slice(0, 10) : "",
            rs?.endAt ? rs.endAt.slice(0, 10) : "",
            rs?.territoryCodes?.length ? formatDealTerritoryCodes(rs.territoryCodes) : "",
            String(snap.paymentModel ?? ""),
            gross,
          ]);
        }
      }
    } else if (tab === "sales") {
      headers = ["ID", "Тайтл", "Покупатель", "Стадия", "Дата подписи", "Нач. лицензии", "Конец лицензии", "Территория", "Модель оплаты", "Net (Возн-е правообл.) KZT", "Валюта"];
      for (const deal of deals.filter((d) => d.kind === "sale")) {
        for (const row of deal.catalogItems) {
          const rs = parseRs(row.rightsSelection);
          const tid = catalog.find((c) => c.id === row.catalogItemId);
          const t = tid ? titleId(tid) : row.catalogItemId.slice(0, 8);
          const snap = deal.commercialSnapshot ?? {};
          const ev = snap.expectedValue;
          const fee = typeof ev === "string" || typeof ev === "number" ? formatMoneyAmount(String(ev)) : "";
          rows.push([
            `S-${deal.id.slice(0, 8)}`,
            t,
            deal.buyer.legalName,
            dealStageLabel(deal.stage),
            snap.signedAt ? snap.signedAt.slice(0, 10) : "",
            rs?.startAt ? rs.startAt.slice(0, 10) : "",
            rs?.endAt ? rs.endAt.slice(0, 10) : "",
            rs?.territoryCodes?.length ? formatDealTerritoryCodes(rs.territoryCodes) : "",
            String(snap.paymentModel ?? ""),
            fee,
            deal.currency,
          ]);
        }
      }
    } else if (tab === "platforms") {
      headers = ["ID организации", "Наименование", "Страна", "Осн. языки", "Предпочтит. жанры", "Готовность к эксклюзиву", "Предпочтит. срок", "Средний бюджет", "Платёжная дисциплина", "Тех. требования", "Контакт (ФИО)", "Email", "Телефон", "Примечания"];
      for (const o of orgs) {
        const m = o.metadata ?? {};
        rows.push([
          `P-${o.id.slice(0, 6)}`,
          o.legalName,
          o.country,
          m.primaryLanguages ?? "",
          m.preferredGenres ?? "",
          m.exclusivityReadiness ?? "",
          m.preferredTerm ?? "",
          m.averageBudget ?? "",
          m.paymentDiscipline ?? "",
          m.techRequirements ?? "",
          m.contactName ?? "",
          m.contactEmail ?? "",
          m.contactPhone ?? "",
          m.notes ?? "",
        ]);
      }
    } else {
      return;
    }

    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const csvContent = [headers, ...rows].map((r) => r.map(escape).join(",")).join("\n");
    const blob = new Blob(["﻿" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rights-base-${tab}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /// Группируем запросы материалов по catalogItemId для быстрого доступа
  /// в таблице «Материалы». Один тайтл может иметь несколько запросов
  /// (разные слоты, разные итерации).
  const materialRequestsByCatalogItemId = useMemo(() => {
    const m = new Map<string, MaterialRequest[]>();
    for (const r of materialRequests) {
      const arr = m.get(r.catalogItemId) ?? [];
      arr.push(r);
      m.set(r.catalogItemId, arr);
    }
    return m;
  }, [materialRequests]);

  const chainStatusByCatalogItemId = useMemo(() => {
    const statuses = new Map<string, string>();
    for (const item of catalog) {
      const purchaseDeals = deals.filter(
        (d) =>
          d.kind === "purchase" &&
          d.catalogItems.some((ci) => ci.catalogItemId === item.id),
      );
      if (!purchaseDeals.length) {
        statuses.set(item.id, "Не загружены");
        continue;
      }
      const allDealsHaveAllDocs = purchaseDeals.every((d) => {
        const docs = d.dealDocuments ?? {};
        return CHAIN_REQUIRED_SLOTS.every((slot) => Boolean(docs[slot]));
      });
      statuses.set(item.id, allDealsHaveAllDocs ? "Загружены" : "Не загружены");
    }
    return statuses;
  }, [catalog, deals]);

  const acquisitionRows = useMemo(() => {
    const rows: React.ReactNode[] = [];
    for (const deal of deals.filter((d) => d.kind === "purchase")) {
      for (const row of deal.catalogItems) {
        const rs = parseRs(row.rightsSelection);
        // Expiry filter
        if (expiryThreshold && rs?.endAt) {
          const endT = new Date(rs.endAt).getTime();
          if (endT > expiryThreshold) continue;
        }
        const tid = catalog.find((c) => c.id === row.catalogItemId);
        const t = tid ? titleId(tid) : `T-${row.catalogItemId.slice(0, 8)}`;
        const snap = deal.commercialSnapshot ?? {};
        const ev = snap.expectedValue;
        const gross =
          typeof ev === "string" || typeof ev === "number"
            ? formatMoneyAmount(String(ev))
            : "—";
        const ctrs = contractsByDealId.get(deal.id) ?? [];
        const c0 = ctrs[0];
        const territory = rs?.territoryCodes?.length
          ? formatDealTerritoryCodes(rs.territoryCodes)
          : "—";
        const rsLangStr = rs?.languageRights?.length
          ? rs.languageRights.join("; ")
          : "—";
        const licStart = rs?.startAt ? rs.startAt.slice(0, 4) : "—";
        const licEnd = rs?.endAt ? rs.endAt.slice(0, 4) : "—";
        let termYears = "—";
        if (rs?.startAt && rs?.endAt) {
          const a = new Date(rs.startAt).getTime();
          const b = new Date(rs.endAt).getTime();
          if (Number.isFinite(a) && Number.isFinite(b) && b > a) {
            termYears = (Math.round((b - a) / (365.25 * 24 * 3600 * 1000) * 10) / 10).toString();
          }
        }
        const signedAt = snap.signedAt ? snap.signedAt.slice(0, 10) : "—";
        const effectiveAt = snap.effectiveAt ? snap.effectiveAt.slice(0, 10) : "—";
        const paymentModel = snap.paymentModel ?? "—";
        const paymentTerms = snap.paymentTerms ?? "—";
        const deliveryDeadline = snap.deliveryDeadline ? snap.deliveryDeadline.slice(0, 10) : "—";
        const notes = snap.notes ?? "—";
        rows.push(
          <tr key={`${deal.id}-${row.catalogItemId}`}>
            <Td>A-{deal.id.slice(0, 8)}</Td>
            <Td>{t}</Td>
            <Td>{deal.buyer.legalName}</Td>
            <Td>{c0?.number ?? "—"}</Td>
            <Td>{dealStageLabel(deal.stage)}</Td>
            <Td>{signedAt}</Td>
            <Td>{effectiveAt}</Td>
            <Td>{licStart}</Td>
            <Td>{licEnd}</Td>
            <Td>{termYears}</Td>
            <Td>{territory}</Td>
            <Td>{rsLangStr}</Td>
            <Td>{rs ? platformsToRightsAcquired(rs.platforms) : "—"}</Td>
            <Td>{rs ? exclusivityTemplate(rs.exclusivity) : "—"}</Td>
            <Td>{rs?.holdback ?? "—"}</Td>
            <Td>{paymentModel}</Td>
            <Td>{gross}</Td>
            <Td>{paymentTerms}</Td>
            <Td>{deliveryDeadline}</Td>
            <Td className="max-w-[14rem] truncate" title={notes !== "—" ? notes : deal.title}>
              {notes}
            </Td>
          </tr>,
        );
      }
    }
    return rows;
  }, [deals, catalog, contractsByDealId, expiryThreshold]);

  const salesRows = useMemo(() => {
    const rows: React.ReactNode[] = [];
    for (const deal of deals.filter((d) => d.kind === "sale")) {
      for (const row of deal.catalogItems) {
        const rs = parseRs(row.rightsSelection);
        // Expiry filter
        if (expiryThreshold && rs?.endAt) {
          const endT = new Date(rs.endAt).getTime();
          if (endT > expiryThreshold) continue;
        }
        const tid = catalog.find((c) => c.id === row.catalogItemId);
        const t = tid ? titleId(tid) : `T-${row.catalogItemId.slice(0, 8)}`;
        const snap = deal.commercialSnapshot ?? {};
        const ev = snap.expectedValue;
        const fee =
          typeof ev === "string" || typeof ev === "number"
            ? formatMoneyAmount(String(ev))
            : "—";
        const ctrs = contractsByDealId.get(deal.id) ?? [];
        const c0 = ctrs[0];
        const territory = rs?.territoryCodes?.length
          ? formatDealTerritoryCodes(rs.territoryCodes)
          : "—";
        const rsLangStrSale = rs?.languageRights?.length
          ? rs.languageRights.join("; ")
          : "—";
        const licStart = rs?.startAt ? rs.startAt.slice(0, 4) : "—";
        const licEnd = rs?.endAt ? rs.endAt.slice(0, 4) : "—";
        let termYears = "—";
        if (rs?.startAt && rs?.endAt) {
          const a = new Date(rs.startAt).getTime();
          const b = new Date(rs.endAt).getTime();
          if (Number.isFinite(a) && Number.isFinite(b) && b > a) {
            termYears = (Math.round((b - a) / (365.25 * 24 * 3600 * 1000) * 10) / 10).toString();
          }
        }
        const saleSignedAt = snap.signedAt ? snap.signedAt.slice(0, 10) : "—";
        const salePaymentModel = snap.paymentModel ?? "—";
        const salePaymentTerms = snap.paymentTerms ?? "—";
        const saleNotes = snap.notes ?? "—";
        rows.push(
          <tr key={`${deal.id}-${row.catalogItemId}`}>
            <Td>S-{deal.id.slice(0, 8)}</Td>
            <Td>{t}</Td>
            <Td>P-{deal.buyer.id.slice(0, 6)}</Td>
            <Td>{deal.buyer.legalName}</Td>
            <Td>{deal.buyer.country === "KZ" ? "Резидент" : "Нерезидент"}</Td>
            <Td>{dealStageLabel(deal.stage)}</Td>
            <Td>{c0?.number ?? "—"}</Td>
            <Td>{saleSignedAt}</Td>
            <Td>{licStart}</Td>
            <Td>{licEnd}</Td>
            <Td>{termYears}</Td>
            <Td>{territory}</Td>
            <Td>{rsLangStrSale}</Td>
            <Td>{rs ? platformsToRightsAcquired(rs.platforms) : "—"}</Td>
            <Td>{rs ? exclusivityTemplate(rs.exclusivity) : "—"}</Td>
            <Td>{rs?.holdback ?? "—"}</Td>
            <Td>{salePaymentModel}</Td>
            <Td>{fee}</Td>
            <Td>{snap.minimumGuarantee ? formatMoneyAmount(snap.minimumGuarantee) : "—"}</Td>
            <Td>{deal.currency}</Td>
            <Td>{salePaymentTerms}</Td>
            <Td className="max-w-[14rem] truncate" title={saleNotes !== "—" ? saleNotes : deal.title}>
              {saleNotes}
            </Td>
          </tr>,
        );
      }
    }
    return rows;
  }, [deals, catalog, contractsByDealId, expiryThreshold]);

  if (loading) {
    return (
      <div className="p-8 text-sm text-muted-foreground">Загрузка базы прав…</div>
    );
  }

  return (
    <div className="space-y-4">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-foreground">
          {tr("crm", "rightsBaseTitle")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {tr("crm", "rightsBaseSubtitle")}
        </p>
      </motion.div>

      {err ? (
        <p className="text-sm text-destructive whitespace-pre-wrap">{err}</p>
      ) : null}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full gap-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <TabsList className="flex h-auto max-w-full flex-wrap justify-start gap-1 rounded-xl bg-muted p-1">
            <TabsTrigger value="titles" className="text-xs sm:text-sm">
              Реестр тайтлов
            </TabsTrigger>
            <TabsTrigger value="acq" className="text-xs sm:text-sm">
              Сделки закупа
            </TabsTrigger>
            <TabsTrigger value="sales" className="text-xs sm:text-sm">
              Сделки продаж
            </TabsTrigger>
            <TabsTrigger value="platforms" className="text-xs sm:text-sm">
              Площадки
            </TabsTrigger>
            <TabsTrigger value="deliverables" className="text-xs sm:text-sm">
              Материалы
            </TabsTrigger>
            <TabsTrigger value="dict" className="text-xs sm:text-sm">
              Справочники
            </TabsTrigger>
          </TabsList>

          {/* Toolbar: expiry filter + CSV export */}
          <div className="flex flex-wrap items-center gap-2">
            {(activeTab === "acq" || activeTab === "sales") && (
              <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1 text-xs font-semibold">
                <span className="px-2 text-muted-foreground">Истекают через:</span>
                {([60, 90, 180] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setExpiryDays((prev) => (prev === d ? null : d))}
                    className={`rounded px-2 py-1 transition-colors ${
                      expiryDays === d
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {d}д
                  </button>
                ))}
                {expiryDays && (
                  <button
                    type="button"
                    onClick={() => setExpiryDays(null)}
                    className="rounded px-2 py-1 text-muted-foreground hover:bg-muted"
                  >
                    ✕
                  </button>
                )}
              </div>
            )}
            {["titles", "acq", "sales", "platforms"].includes(activeTab) && (
              <button
                type="button"
                onClick={() => exportCsv(activeTab)}
                className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors"
              >
                ↓ CSV
              </button>
            )}
          </div>
        </div>

        <TabsContent value="titles" className="mt-0">
          <TableShell>
            <thead>
              <tr>
                <Th>ID тайтла</Th>
                <Th>Оригинальное название</Th>
                <Th>Локальное название</Th>
                <Th>Тип контента</Th>
                <Th>Количество сезонов</Th>
                <Th>Количество эпизодов</Th>
                <Th>Общий хронометраж (мин)</Th>
                <Th>Год производства</Th>
                <Th>Страна производства</Th>
                <Th>Жанр</Th>
                <Th>Возрастной рейтинг</Th>
                <Th>Правообладатель</Th>
                <Th>Категория фильма (премьера)</Th>
                <Th>Нужна локализация</Th>
                <Th>Статус муз. прав</Th>
                <Th>Статус цепочки прав</Th>
              </tr>
            </thead>
            <tbody>
              {catalog.map((item) => {
                const meta = readCatalogOfferSourceMeta(item.metadata);
                const currentYear = String(new Date().getFullYear());
                const premiereCategoryCell =
                  meta.productionYear?.trim() === currentYear
                    ? formatPremiereCategory(meta.premiereCategory)
                    : "—";
                const langs =
                  item.licenseTerms?.flatMap((l) => l.languageRights ?? []) ?? [];
                const loc =
                  langs.length > 0 ? (langs.includes("original") ? "Да" : "Да") : "—";
                return (
                  <tr key={item.id}>
                    <Td>{titleId(item)}</Td>
                    <Td>{item.title}</Td>
                    <Td>{meta.contentTitle?.trim() || item.title}</Td>
                    <Td>{formatAssetTypeLabel(item.assetType)}</Td>
                    <Td>
                      {meta.seasonCount != null
                        ? String(meta.seasonCount)
                        : item.assetType === "series" ||
                            item.assetType === "animated_series" ||
                            item.assetType === "anime_series"
                          ? "1"
                          : "—"}
                    </Td>
                    <Td>
                      {meta.episodeCount != null ? String(meta.episodeCount) : "—"}
                    </Td>
                    <Td>{meta.runtime?.trim() || "—"}</Td>
                    <Td>{meta.productionYear?.trim() || "—"}</Td>
                    <Td>{meta.countryOfProduction?.trim() || "—"}</Td>
                    <Td>{meta.genre?.trim() || "—"}</Td>
                    <Td>{meta.ageRating?.trim() || "—"}</Td>
                    <Td>{item.rightsHolder.legalName}</Td>
                    <Td>{premiereCategoryCell}</Td>
                    <Td>{meta.localizationNeeded?.trim() || loc}</Td>
                    <Td>{meta.musicRightsStatus?.trim() || "—"}</Td>
                    <Td>{chainStatusByCatalogItemId.get(item.id) ?? "Не загружены"}</Td>
                  </tr>
                );
              })}
            </tbody>
          </TableShell>
        </TabsContent>

        <TabsContent value="acq" className="mt-0">
          <TableShell>
            <thead>
              <tr>
                <Th>ID сделки закупа</Th>
                <Th>ID тайтла</Th>
                <Th>Правообладатель/лицензиар</Th>
                <Th>№ договора</Th>
                <Th>Статус сделки</Th>
                <Th>Дата подписания</Th>
                <Th>Дата вступления в силу</Th>
                <Th>Начало лицензии</Th>
                <Th>Окончание лицензии</Th>
                <Th>Срок (лет)</Th>
                <Th>Территория</Th>
                <Th>Языковые права</Th>
                <Th>Приобретённые права</Th>
                <Th>Формат лицензии</Th>
                <Th>Окно/холдбэк</Th>
                <Th>Модель оплаты</Th>
                <Th>Net (Лицензионное вознаграждение правообладателю) KZT</Th>
                <Th>Условия оплаты</Th>
                <Th>Срок поставки материалов</Th>
                <Th>Примечания (сделка)</Th>
              </tr>
            </thead>
            <tbody>
              {acquisitionRows.length ? (
                acquisitionRows
              ) : (
                <tr>
                  <Td colSpan={20} className="text-muted-foreground">
                    Нет сделок закупа (purchase) с привязкой к каталогу.
                  </Td>
                </tr>
              )}
            </tbody>
          </TableShell>
        </TabsContent>

        <TabsContent value="sales" className="mt-0">
          <TableShell>
            <thead>
              <tr>
                <Th>ID продажи</Th>
                <Th>ID тайтла</Th>
                <Th>ID площадки</Th>
                <Th>Покупатель</Th>
                <Th>Тип покупателя</Th>
                <Th>Статус сделки</Th>
                <Th>№ договора</Th>
                <Th>Дата подписания</Th>
                <Th>Начало лицензии</Th>
                <Th>Окончание лицензии</Th>
                <Th>Срок (лет)</Th>
                <Th>Проданная территория</Th>
                <Th>Проданные языки</Th>
                <Th>Проданные права</Th>
                <Th>Формат лицензии</Th>
                <Th>Позиция окна</Th>
                <Th>Модель оплаты</Th>
                <Th>Net (Лицензионное вознаграждение правообладателю) KZT</Th>
                <Th>Минимальная гарантия</Th>
                <Th>Валюта</Th>
                <Th>Условия оплаты</Th>
                <Th>Примечания</Th>
              </tr>
            </thead>
            <tbody>
              {salesRows.length ? (
                salesRows
              ) : (
                <tr>
                  <Td colSpan={22} className="text-muted-foreground">
                    Нет сделок продажи (sale) с привязкой к каталогу.
                  </Td>
                </tr>
              )}
            </tbody>
          </TableShell>
        </TabsContent>

        <TabsContent value="platforms" className="mt-0">
          <TableShell>
            <thead>
              <tr>
                <Th>ID площадки</Th>
                <Th>Название площадки</Th>
                <Th>Название компании</Th>
                <Th>Тип площадки</Th>
                <Th>Ключевые территории</Th>
                <Th>Основные языки</Th>
                <Th>Предпочитаемые жанры</Th>
                <Th>Готовность к эксклюзиву</Th>
                <Th>Предпочтительный срок</Th>
                <Th>Средний бюджет</Th>
                <Th>Платежная дисциплина</Th>
                <Th>Тех. требования</Th>
                <Th>Основной контакт</Th>
                <Th>Эл. почта</Th>
                <Th>Телефон</Th>
                <Th>Примечания</Th>
              </tr>
            </thead>
            <tbody>
              {orgs.map((o) => {
                const m = o.metadata ?? {};
                return (
                  <tr key={o.id}>
                    <Td>P-{o.id.slice(0, 6)}</Td>
                    <Td>{o.legalName}</Td>
                    <Td>{o.legalName}</Td>
                    <Td>клиент (CRM)</Td>
                    <Td>{dealTerritoryLabel(o.country)}</Td>
                    <Td>{m.primaryLanguages ?? "—"}</Td>
                    <Td>{m.preferredGenres ?? "—"}</Td>
                    <Td>{m.exclusivityReadiness ?? "—"}</Td>
                    <Td>{m.preferredTerm ?? "—"}</Td>
                    <Td>{m.averageBudget ?? "—"}</Td>
                    <Td>{m.paymentDiscipline ?? "—"}</Td>
                    <Td>{m.techRequirements ?? "—"}</Td>
                    <Td>{m.contactName ?? "—"}</Td>
                    <Td>{m.contactEmail ?? "—"}</Td>
                    <Td>{m.contactPhone ?? "—"}</Td>
                    <Td className="max-w-[14rem] truncate" title={m.notes ?? ""}>{m.notes ?? "—"}</Td>
                  </tr>
                );
              })}
            </tbody>
          </TableShell>
        </TabsContent>

        <TabsContent value="deliverables" className="mt-0">
          <TableShell>
            <thead>
              <tr>
                <Th>ID тайтла</Th>
                <Th>Мастер-видео</Th>
                <Th>Аудио (сведение)</Th>
                <Th>M&E (музыка и эффекты)</Th>
                <Th>Субтитры</Th>
                <Th>Дубляж/VO</Th>
                <Th>Трейлер</Th>
                <Th>Постер/кей-арт</Th>
                <Th>Метаданные</Th>
                <Th>Синопсис</Th>
                <Th>Ссылка/путь к файлу</Th>
                <Th>Статус материалов</Th>
                <Th>Примечания</Th>
              </tr>
            </thead>
            <tbody>
              {catalog.map((item) => {
                const reqs = materialRequestsByCatalogItemId.get(item.id) ?? [];
                const agg = aggregateMaterialStatus(reqs);
                const masterVideo = slotCellStatus(reqs, ["master_video"]);
                const subtitles = slotCellStatus(reqs, [
                  "subtitles_ru",
                  "subtitles_kz",
                  "subtitles_en",
                ]);
                const dub = slotCellStatus(reqs, ["dub_audio"]);
                const trailer = slotCellStatus(reqs, ["trailer"]);
                const posterReq = slotCellStatus(reqs, ["poster", "banner", "still"]);
                const synopsis = slotCellStatus(reqs, ["synopsis"]);
                const techSpecs = slotCellStatus(reqs, ["tech_specs"]);
                const activeCount = reqs.filter(
                  (r) => r.status !== "cancelled" && r.status !== "rejected",
                ).length;
                const latestNote = reqs
                  .slice()
                  .sort((a, b) =>
                    a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0,
                  )
                  .find((r) => (r.note ?? "").trim().length > 0)?.note;
                return (
                  <tr key={item.id}>
                    <Td>{titleId(item)}</Td>
                    <Td><SlotStatusCell status={masterVideo} /></Td>
                    <Td><span className="text-muted-foreground">—</span></Td>
                    <Td><span className="text-muted-foreground">—</span></Td>
                    <Td><SlotStatusCell status={subtitles} /></Td>
                    <Td><SlotStatusCell status={dub} /></Td>
                    <Td><SlotStatusCell status={trailer} /></Td>
                    <Td>
                      {posterReq !== "none" ? (
                        <SlotStatusCell status={posterReq} />
                      ) : item.posterFileName ? (
                        <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                          есть постер
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </Td>
                    <Td><SlotStatusCell status={techSpecs} /></Td>
                    <Td><SlotStatusCell status={synopsis} /></Td>
                    <Td><span className="text-muted-foreground">—</span></Td>
                    <Td>
                      {agg ? (
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_TONE[agg]}`}
                          title={`${activeCount} активных ${activeCount === 1 ? "запрос" : "запроса/-ов"}`}
                        >
                          {STATUS_LABEL[agg]}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Не запрошены</span>
                      )}
                    </Td>
                    <Td className="max-w-[280px] truncate" title={latestNote ?? undefined}>
                      {activeCount > 0
                        ? `${activeCount} ${activeCount === 1 ? "запрос" : activeCount < 5 ? "запроса" : "запросов"}${latestNote ? ` · ${latestNote}` : ""}`
                        : "—"}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </TableShell>
        </TabsContent>

        <TabsContent value="dict" className="mt-0">
          <div className="space-y-8">

            {/* ── Введение ── */}
            <div className="rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-900 p-5">
              <h2 className="text-base font-bold text-blue-900 dark:text-blue-200 mb-2">📖 Справочник по Базе прав</h2>
              <p className="text-sm text-blue-800 dark:text-blue-300 leading-relaxed mb-3">
                Здесь собрана вся документация по разделу «База прав»: описание каждой вкладки, назначение каждого столбца и подсказки по заполнению.
                Открывайте этот раздел, если не знаете, что означает поле, как его заполнять или зачем оно нужно.
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-400 leading-relaxed">
                <strong>База прав</strong> — единый реестр всего контента и всех лицензионных сделок компании. Здесь фиксируется: какой контент есть, у кого куплен, кому продан, на каких условиях, за какие деньги и в каком состоянии находятся материалы. Без актуальной Базы прав невозможно быстро проверить, можно ли продать конкретный фильм на конкретную территорию, не пересекается ли новая сделка с действующей и когда истекают права.
              </p>
            </div>

            {/* ── 1. Реестр тайтлов ── */}
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-base">🎬</span>
                <h2 className="text-sm font-bold">Вкладка: Реестр тайтлов</h2>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                Главный каталог контента компании. Каждая строка — один тайтл (фильм, сериал, документалка, анимация). Тайтл нужно завести здесь <strong>до</strong> создания любой сделки. Данные подтягиваются автоматически из карточки контента — менеджеру вручную заполнять ничего не нужно, только проверять актуальность.
              </p>
              <TableShell>
                <thead>
                  <tr>
                    <Th>Столбец</Th>
                    <Th>Что означает</Th>
                    <Th>Как заполнять / на что влияет</Th>
                  </tr>
                </thead>
                <tbody>
                  {([
                    ["ID тайтла", "Уникальный код тайтла в системе (T-slug или T-uuid)", "Генерируется автоматически. Используется для поиска и связи между вкладками — по этому коду тайтл появляется в сделках и материалах"],
                    ["Оригинальное название", "Название на языке оригинала (английское, корейское и т.д.)", "Указывается точно как в договоре с правообладателем. Нельзя сокращать или переводить"],
                    ["Локальное название", "Русское или казахское название для местного рынка", "Используется в переговорах с покупателями и в промо. Если нет локального — дублируется оригинальное"],
                    ["Тип контента", "Формат: полный метр, сериал, документальный, анимация и т.д.", "Влияет на категорию прав и ценообразование. Сериалы требуют указания числа сезонов и эпизодов"],
                    ["Количество сезонов", "Число сезонов, включённых в сделку", "Только для сериалов. Для полного метра — прочерк. Важно: если куплен только 1-й сезон из 3-х — указываем 1"],
                    ["Количество эпизодов", "Общее число эпизодов во всех сезонах", "Нужно для модели оплаты «За эпизод». Также используется при расчёте хронометража"],
                    ["Общий хронометраж (мин)", "Суммарная длительность контента в минутах", "Используется при технических требованиях, расчёте трафика и вещательных лицензиях"],
                    ["Год производства", "Год выхода или производства контента", "Тайтлы текущего года автоматически получают статус «Премьера» — это повышает ценность при продаже"],
                    ["Страна производства", "Страна-производитель контента", "Важна для расчёта КПН (налог у источника): нерезиденты платят по-другому"],
                    ["Жанр", "Жанровая принадлежность: драма, комедия, триллер и т.д.", "Используется при подборе контента для площадок с жанровыми предпочтениями (см. вкладку «Площадки»)"],
                    ["Возрастной рейтинг", "Рейтинг: 0+, 6+, 12+, 16+, 18+", "Часть покупателей принимает только контент определённого рейтинга. Нужно уточнять при переговорах"],
                    ["Правообладатель", "Компания или физлицо, у которого куплены права", "Должен совпадать с правообладателем в договоре закупа. Заводится через раздел «Контрагенты»"],
                    ["Категория фильма (премьера)", "Мировая / региональная / локальная премьера", "Заполняется только для тайтлов текущего года. Влияет на цену: премьерный контент стоит дороже"],
                    ["Нужна локализация", "Требуется ли перевод / дубляж / субтитры", "Если «Да» — нужно заложить время и бюджет на локализацию до передачи материалов покупателю"],
                    ["Статус муз. прав", "Получены ли права на музыку в фильме", "Нерешённые музыкальные права блокируют показ на ряде платформ. Варианты: Получены / В процессе / Не проверено"],
                    ["Статус цепочки прав", "Загружены ли все документы chain of title", "Без полной цепочки (договоры, свидетельства, авторские права) нельзя заключать сделки с серьёзными платформами"],
                  ] as [string, string, string][]).map(([col, meaning, how]) => (
                    <tr key={col}>
                      <Td><span className="font-medium whitespace-nowrap">{col}</span></Td>
                      <Td>{meaning}</Td>
                      <Td className="text-muted-foreground">{how}</Td>
                    </tr>
                  ))}
                </tbody>
              </TableShell>
            </div>

            {/* ── 2. Сделки закупа ── */}
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-base">📥</span>
                <h2 className="text-sm font-bold">Вкладка: Сделки закупа</h2>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                Реестр договоров, по которым компания <strong>купила</strong> права у правообладателей. Каждая строка — один тайтл в рамках одной сделки. Если в договоре куплено 5 фильмов — будет 5 строк. Данные этой вкладки определяют, <strong>какие права есть у компании</strong> для перепродажи: нельзя продать то, чего не куплено.
              </p>
              <TableShell>
                <thead>
                  <tr>
                    <Th>Столбец</Th>
                    <Th>Что означает</Th>
                    <Th>Как заполнять / на что влияет</Th>
                  </tr>
                </thead>
                <tbody>
                  {([
                    ["ID сделки закупа", "Уникальный код сделки в системе", "Генерируется автоматически. Используется для поиска и ссылок на конкретный договор"],
                    ["ID тайтла", "Ссылка на тайтл из «Реестра тайтлов»", "Один тайтл может быть в нескольких сделках закупа (переоформление, докупка территорий)"],
                    ["Правообладатель/лицензиар", "Компания или физлицо, продавшее права", "Должен совпадать с названием в договоре. Заводится через раздел «Контрагенты»"],
                    ["№ договора", "Номер лицензионного договора", "Заполняется после подписания. До подписания — оставить пустым или написать «в работе»"],
                    ["Статус сделки", "Текущий этап сделки", "Переговоры / На подписании / Действует / Истёк / Расторгнут. Критично обновлять — от этого зависит, можно ли продавать права"],
                    ["Дата подписания", "Дата фактического подписания обеими сторонами", "С этой даты договор юридически существует"],
                    ["Дата вступления в силу", "Дата начала действия прав", "Может отличаться от даты подписания. Например: подписан в декабре, права начинаются с 1 января"],
                    ["Начало лицензии", "Дата начала лицензионного периода", "С этой даты компания может использовать и продавать права. Обычно совпадает с датой вступления в силу"],
                    ["Окончание лицензии", "Дата истечения прав", "После этой даты продавать нельзя. Ставьте напоминание за 3–6 месяцев для переговоров о продлении"],
                    ["Срок (лет)", "Длительность лицензии в годах", "Вычисляется автоматически из дат начала и окончания"],
                    ["Территория", "Страны/регионы, на которые куплены права", "Используйте коды из раздела «Территории» ниже: KZ, RU, CIS, WW. Нельзя продать права на территорию, которой нет здесь"],
                    ["Языковые права", "На каких языках разрешён показ", "RU, KZ — только русский и казахский. При продаже нельзя выйти за эти рамки"],
                    ["Приобретённые права", "Какие типы прав куплены", "SVOD, AVOD, Pay TV и т.д. (см. «Типы прав» ниже). Только эти виды можно перепродавать"],
                    ["Формат лицензии", "Условие эксклюзивности от правообладателя", "Эксклюзив: правообладатель не продаёт то же самое другим. Неэксклюзив: можно"],
                    ["Окно/холдбэк", "Ограничения по времени показа", "Например: «не раньше 90 дней после кинопроката». Если нет — оставить пустым"],
                    ["Модель оплаты", "Структура платежа правообладателю", "Фиксированный платёж, MG, ревенью-шер и т.д. (см. «Модели оплаты» ниже)"],
                    ["Net (Лицензионное вознаграждение) KZT", "Сумма, которую компания платит правообладателю", "Это себестоимость прав. Нужна для расчёта маржинальности при продаже"],
                    ["Условия оплаты", "Сроки и порядок платежей", "Например: «50% при подписании, 50% при поставке материалов». Переписывается из договора"],
                    ["Срок поставки материалов", "Дата, до которой правообладатель обязан передать файлы", "Нарушение — основание для штрафа по договору. Следите за соблюдением"],
                    ["Примечания", "Дополнительные условия и комментарии", "Особые оговорки, договорённости о продлении, история переговоров. Пишите кратко"],
                  ] as [string, string, string][]).map(([col, meaning, how]) => (
                    <tr key={col}>
                      <Td><span className="font-medium whitespace-nowrap">{col}</span></Td>
                      <Td>{meaning}</Td>
                      <Td className="text-muted-foreground">{how}</Td>
                    </tr>
                  ))}
                </tbody>
              </TableShell>
            </div>

            {/* ── 3. Сделки продаж ── */}
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-base">📤</span>
                <h2 className="text-sm font-bold">Вкладка: Сделки продаж</h2>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                Реестр договоров, по которым компания <strong>продала</strong> права покупателям: OTT-платформам, телеканалам, кинотеатрам. Каждая строка — один тайтл в рамках одной сделки продажи. Система автоматически проверяет, не пересекаются ли новые продажи с уже действующими по территории, типу прав и эксклюзивности.
              </p>
              <TableShell>
                <thead>
                  <tr>
                    <Th>Столбец</Th>
                    <Th>Что означает</Th>
                    <Th>Как заполнять / на что влияет</Th>
                  </tr>
                </thead>
                <tbody>
                  {([
                    ["ID продажи", "Уникальный код сделки продажи в системе", "Генерируется автоматически"],
                    ["ID тайтла", "Ссылка на тайтл из «Реестра тайтлов»", "Один тайтл может быть продан нескольким покупателям с разными правами и территориями"],
                    ["ID площадки", "Ссылка на покупателя из вкладки «Площадки»", "Позволяет быстро перейти к карточке покупателя и проверить его требования"],
                    ["Покупатель", "Юридическое название компании-покупателя", "Должно совпадать с названием в договоре"],
                    ["Тип покупателя", "Резидент или нерезидент", "Влияет на налогообложение: нерезиденты платят КПН (налог у источника)"],
                    ["Статус сделки", "Текущий этап сделки", "Переговоры / На подписании / Действует / Истёк / Расторгнут. Обновлять обязательно"],
                    ["№ договора", "Номер лицензионного договора с покупателем", "Заполняется после подписания"],
                    ["Дата подписания", "Дата подписания договора с покупателем", "С этой даты договор юридически существует"],
                    ["Начало лицензии", "Дата начала проданного лицензионного периода", "С этой даты покупатель имеет право использовать контент"],
                    ["Окончание лицензии", "Дата истечения проданных прав", "После этой даты покупатель обязан прекратить показ. Следите за соблюдением"],
                    ["Срок (лет)", "Длительность продажи в годах", "Вычисляется автоматически"],
                    ["Проданная территория", "Страны/регионы, на которые проданы права", "Не может выходить за рамки территорий, купленных у правообладателя (Сделки закупа)"],
                    ["Проданные языки", "На каких языках разрешён показ покупателю", "Не может выходить за рамки языковых прав из договора закупа"],
                    ["Проданные права", "Какие типы прав переданы покупателю", "SVOD, AVOD, Pay TV и т.д. Должны входить в перечень приобретённых прав из закупа"],
                    ["Формат лицензии", "Эксклюзивность для покупателя", "Эксклюзив: этот покупатель единственный на данной территории/платформе. Система не позволит создать конкурирующую сделку"],
                    ["Позиция окна", "Место в очереди показов (окно)", "Например: «Первое окно SVOD» или «После кинопроката». Важно для premium-платформ"],
                    ["Модель оплаты", "Структура платежа от покупателя", "Фиксированный платёж, MG, ревенью-шер и т.д."],
                    ["Net (Лицензионное вознаграждение) KZT", "Сумма лицензионного платежа от покупателя", "Выручка по сделке. Сравните с себестоимостью из закупа для расчёта маржи"],
                    ["Минимальная гарантия", "Гарантированный авансовый платёж (MG)", "Покупатель платит аванс, который «отбивает» из доли выручки. Если выручка ниже MG — разница у вас"],
                    ["Валюта", "Валюта расчётов по сделке", "KZT, USD, EUR и т.д. Зафиксирована в договоре"],
                    ["Условия оплаты", "Сроки и порядок платежей от покупателя", "Например: «100% в течение 30 дней с даты подписания»"],
                    ["Примечания", "Дополнительные условия и комментарии", "Особые требования покупателя, история переговоров, важные договорённости"],
                  ] as [string, string, string][]).map(([col, meaning, how]) => (
                    <tr key={col}>
                      <Td><span className="font-medium whitespace-nowrap">{col}</span></Td>
                      <Td>{meaning}</Td>
                      <Td className="text-muted-foreground">{how}</Td>
                    </tr>
                  ))}
                </tbody>
              </TableShell>
            </div>

            {/* ── 4. Площадки ── */}
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-base">🏢</span>
                <h2 className="text-sm font-bold">Вкладка: Площадки</h2>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                Справочник всех покупателей контента: OTT-платформ, телеканалов, кинотеатров. Заполняется один раз при первом контакте с площадкой и обновляется по мере появления новой информации. Помогает менеджеру быстро вспомнить требования и предпочтения партнёра перед переговорами — не нужно искать письма или спрашивать коллег.
              </p>
              <TableShell>
                <thead>
                  <tr>
                    <Th>Столбец</Th>
                    <Th>Что означает</Th>
                    <Th>Как заполнять / на что влияет</Th>
                  </tr>
                </thead>
                <tbody>
                  {([
                    ["ID площадки", "Уникальный код площадки в системе", "Генерируется автоматически. Используется для связи со сделками продажи"],
                    ["Название площадки", "Торговое название платформы или канала", "Например: «КинопоискHD», «Мегого», «Хабар». Как площадка называет себя на рынке"],
                    ["Название компании", "Юридическое название организации", "Используется в договорах. Может отличаться от торгового названия"],
                    ["Тип площадки", "Категория: OTT, телеканал, кинотеатр и т.д.", "Помогает фильтровать площадки при подборе покупателей для конкретного типа прав"],
                    ["Ключевые территории", "Страны присутствия площадки", "Определяет, на какие территории площадка реально может покупать права"],
                    ["Основные языки", "Языки контента, с которыми работает площадка", "RU, KZ, EN и т.д. Если площадка работает только с русскоязычным контентом — предлагаем только его"],
                    ["Предпочитаемые жанры", "Жанры, которые площадка покупает охотнее всего", "Используйте при подборе контента для питчинга: предлагайте то, что точно нужно этой площадке"],
                    ["Готовность к эксклюзиву", "Платит ли площадка за эксклюзивные права", "Да / Частично / Нет. Площадки с «Да» — приоритет для эксклюзивных сделок с высоким чеком"],
                    ["Предпочтительный срок", "Типичный срок лицензии у этой площадки", "Например: «1–3 года». Помогает заранее понимать ожидания покупателя"],
                    ["Средний бюджет", "Диапазон бюджета площадки на один тайтл", "Например: «$5 000–20 000». Помогает не тратить время на переговоры с неподходящим бюджетом"],
                    ["Платежная дисциплина", "Насколько вовремя площадка платит", "Высокая / Средняя / Низкая. Учитывайте при выборе условий оплаты (предоплата vs. постоплата)"],
                    ["Тех. требования", "Технические требования к файлам", "Например: «ProRes 4K, субтитры SRT, постер 2000×3000». Нужно знать до подготовки материалов"],
                    ["Основной контакт", "ФИО ответственного менеджера", "С кем вести переговоры и переписку по сделкам"],
                    ["Эл. почта", "Email контактного лица", "Для деловой переписки"],
                    ["Телефон", "Телефон контактного лица", "Для оперативной связи"],
                    ["Примечания", "Любая важная информация о площадке", "История отношений, нюансы переговоров, особые требования, внутренние договорённости"],
                  ] as [string, string, string][]).map(([col, meaning, how]) => (
                    <tr key={col}>
                      <Td><span className="font-medium whitespace-nowrap">{col}</span></Td>
                      <Td>{meaning}</Td>
                      <Td className="text-muted-foreground">{how}</Td>
                    </tr>
                  ))}
                </tbody>
              </TableShell>
            </div>

            {/* ── 5. Материалы ── */}
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-base">📦</span>
                <h2 className="text-sm font-bold">Вкладка: Материалы</h2>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                Контроль готовности технических файлов по каждому тайтлу. Перед передачей контента покупателю нужно убедиться, что все необходимые файлы есть и соответствуют требованиям площадки. Эта вкладка — чеклист по каждому тайтлу: что уже готово, чего не хватает и где лежат файлы.
              </p>
              <TableShell>
                <thead>
                  <tr>
                    <Th>Столбец</Th>
                    <Th>Что означает</Th>
                    <Th>Как заполнять / на что влияет</Th>
                  </tr>
                </thead>
                <tbody>
                  {([
                    ["ID тайтла", "Ссылка на тайтл из «Реестра тайтлов»", "Связывает строку материалов с конкретным тайтлом"],
                    ["Мастер-видео", "Финальный видеофайл в высоком качестве", "Обязательный файл для любой сделки. Обычно ProRes, DNxHR или DCP. Без него передача невозможна"],
                    ["Аудио (сведение)", "Финальная аудиодорожка (stereo/5.1)", "Отдельный аудиофайл для технической интеграции на платформах. Часто требуется вместе с M&E"],
                    ["M&E (музыка и эффекты)", "Дорожка без диалогов — только музыка и эффекты", "Нужна для локализации: позволяет перезаписать диалоги на другом языке без потери звукового окружения"],
                    ["Субтитры", "Файл субтитров (SRT, VTT, TTML и др.)", "Обязательны для большинства OTT-платформ. Язык — по условиям договора с покупателем"],
                    ["Дубляж/VO", "Дублированная или закадровая озвучка", "Если площадка требует локализацию — нужно заказать дубляж/VO заранее. Это занимает время и стоит денег"],
                    ["Трейлер", "Промо-ролик тайтла", "Многие OTT-платформы требуют трейлер для размещения в каталоге. Обычно 1,5–3 минуты"],
                    ["Постер/кей-арт", "Ключевое изображение для продвижения", "Обязателен для всех платформ. Размер и формат — по техническим требованиям площадки (см. «Площадки»)"],
                    ["Метаданные", "Текстовое описание тайтла для платформы", "Синопсис, каст, режиссёр, год, жанр и т.д. Обычно в формате XML или таблице по шаблону платформы"],
                    ["Синопсис", "Краткое описание содержания", "Нужен для каталога платформы и промо-материалов. Обычно 100–500 слов на русском и/или английском"],
                    ["Ссылка/путь к файлу", "Где хранится файл (ссылка на диск или путь)", "Ставьте ссылку на папку в Google Drive, Hetzner или другом хранилище, чтобы файл можно было быстро найти"],
                    ["Статус материалов", "Общий статус готовности пакета материалов", "Готово / В процессе / Не получены. Обновляйте по мере получения файлов от правообладателя"],
                    ["Примечания", "Дополнительные комментарии по материалам", "Например: «субтитры на KZ заказаны, срок — 15 мая» или «трейлер только на английском, перевод нужен»"],
                  ] as [string, string, string][]).map(([col, meaning, how]) => (
                    <tr key={col}>
                      <Td><span className="font-medium whitespace-nowrap">{col}</span></Td>
                      <Td>{meaning}</Td>
                      <Td className="text-muted-foreground">{how}</Td>
                    </tr>
                  ))}
                </tbody>
              </TableShell>
            </div>

            {/* ── Словари ── */}
            <div className="grid gap-6 lg:grid-cols-2">

              <div className="rounded-xl border border-border bg-card p-4">
                <h3 className="text-sm font-bold mb-1">📋 Типы прав</h3>
                <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                  Определяет, каким способом покупатель может использовать контент. Один тайтл можно продать разным покупателям с разными типами прав — главное, чтобы не было конфликта по территории и эксклюзивности.
                </p>
                <TableShell>
                  <thead><tr><Th>Код</Th><Th>Что означает</Th></tr></thead>
                  <tbody>
                    {DICTIONARIES.rightsTypes.map(([a, b]) => (
                      <tr key={a}><Td><span className="font-mono font-semibold">{a}</span></Td><Td>{b}</Td></tr>
                    ))}
                  </tbody>
                </TableShell>
                <p className="text-[11px] text-muted-foreground mt-2">💡 Купили только SVOD — продать Pay TV нельзя. Продаёте сериал платформе (SVOD) и каналу (Pay TV) одновременно — это нормально, если в закупе есть оба права.</p>
              </div>

              <div className="rounded-xl border border-border bg-card p-4">
                <h3 className="text-sm font-bold mb-1">🔒 Формат лицензии (Эксклюзивность)</h3>
                <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                  Определяет, сколько покупателей могут одновременно использовать контент на одной территории и платформе. Система автоматически блокирует конфликтующие сделки.
                </p>
                <TableShell>
                  <thead><tr><Th>Значение</Th><Th>Смысл</Th></tr></thead>
                  <tbody>
                    {DICTIONARIES.exclusivity.map(([a, b]) => (
                      <tr key={a}><Td><span className="font-medium">{a}</span></Td><Td>{b}</Td></tr>
                    ))}
                  </tbody>
                </TableShell>
                <p className="text-[11px] text-muted-foreground mt-2">💡 Холдбэк — отсрочка перед следующим типом показа. Пример: фильм вышел в кино, площадка требует 90 дней до запуска на SVOD. Указывается в поле «Окно/холдбэк».</p>
              </div>

              <div className="rounded-xl border border-border bg-card p-4">
                <h3 className="text-sm font-bold mb-1">💰 Модели оплаты</h3>
                <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                  Определяет структуру платежа по сделке. От модели зависит, как формируются инвойсы и финансовая отчётность.
                </p>
                <TableShell>
                  <thead><tr><Th>Модель</Th><Th>Механика</Th></tr></thead>
                  <tbody>
                    {DICTIONARIES.paymentModels.map(([a, b]) => (
                      <tr key={a}><Td><span className="font-medium">{a}</span></Td><Td>{b}</Td></tr>
                    ))}
                  </tbody>
                </TableShell>
                <p className="text-[11px] text-muted-foreground mt-2">💡 MG (минимальная гарантия) — покупатель платит аванс, который потом «отбивает» из доли выручки. Если выручка ниже MG — разница остаётся у вас.</p>
              </div>

              <div className="rounded-xl border border-border bg-card p-4">
                <h3 className="text-sm font-bold mb-1">🌍 Территории и языки</h3>
                <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                  Коды территорий и языков для полей в сделках. Используйте именно эти коды — система по ним проверяет пересечения прав.
                </p>
                <TableShell>
                  <thead><tr><Th>Код территории</Th><Th>Название</Th><Th>Код языка</Th><Th>Язык</Th></tr></thead>
                  <tbody>
                    {DICTIONARIES.territories.map(([tc, tn], i) => {
                      const lang = DICTIONARIES.languages[i] ?? ["—", "—"];
                      return (
                        <tr key={tc}>
                          <Td><span className="font-mono font-semibold">{tc}</span></Td>
                          <Td>{tn}</Td>
                          <Td><span className="font-mono font-semibold">{lang[0]}</span></Td>
                          <Td>{lang[1]}</Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </TableShell>
                <p className="text-[11px] text-muted-foreground mt-2">💡 WW = весь мир. CIS = страны СНГ. CA = Центральная Азия (KZ+UZ+KG+TJ+TM). Для конкретной страны — используйте её отдельный код.</p>
              </div>

            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
