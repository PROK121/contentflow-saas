"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { v1Fetch } from "@/lib/v1-client";
import { formatAssetTypeLabel } from "@/lib/asset-type-labels";
import { formatMoneyAmount } from "@/lib/format-money";
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
  commercialSnapshot?: Record<string, unknown> | null;
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
  "Шаблон базы прав для дистрибуционной компании",
  "",
  "Как использовать",
  "1. Реестр тайтлов — единая карточка контента. Один тайтл = одна строка.",
  "2. Сделки закупа — все сделки по закупу прав у правообладателей.",
  "3. Сделки продаж — все сделки по продаже/лицензированию контента площадкам и каналам.",
  "4. Площадки — карточки покупателей/площадок с их бизнес-моделью и требованиями.",
  "5. Материалы — контроль материалов и юридических документов по каждому тайтлу.",
  "6. Справочники — унификация прав, территорий, языков, моделей оплаты и статусов.",
  "",
  "Что обязательно вести",
  "• сроки начала и окончания прав",
  "• территория и языки",
  "• вид прав: SVOD / AVOD / TVOD / EST / Платное ТВ / Бесплатное ТВ / Бортовые / Нетеатральные и т.д.",
  "• эксклюзивность и ограничения",
  "• суммы, валюта, налоги, ревенью-шер, MG",
  "• статус договора, инвойса, поставки материалов и промо-активов",
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
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <td
      className={`border-b border-border/60 px-2 py-1.5 text-xs text-foreground align-top ${className}`}
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
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const [cat, dls, org, ctr] = await Promise.all([
        v1Fetch<CatalogItemRow[]>("/catalog/items"),
        v1Fetch<DealRow[]>("/deals"),
        v1Fetch<OrgRow[]>("/organizations?type=client"),
        v1Fetch<ContractRow[]>("/contracts?limit=200"),
      ]);
      setCatalog(cat.filter((c) => c.status !== "archived"));
      setDeals(dls.filter((x) => x.archived !== true));
      setOrgs(org);
      setContracts(ctr);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка загрузки");
      setCatalog([]);
      setDeals([]);
      setOrgs([]);
      setContracts([]);
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
        const langs =
          tid?.licenseTerms
            ?.flatMap((lt) => lt.languageRights ?? [])
            .filter(Boolean) ?? [];
        const langStr = [...new Set(langs)].join("; ") || "—";
        const licStart = rs?.startAt
          ? rs.startAt.slice(0, 10)
          : "—";
        const licEnd = rs?.endAt ? rs.endAt.slice(0, 10) : "—";
        let termMonths = "—";
        if (rs?.startAt && rs?.endAt) {
          const a = new Date(rs.startAt).getTime();
          const b = new Date(rs.endAt).getTime();
          if (Number.isFinite(a) && Number.isFinite(b) && b > a) {
            termMonths = String(Math.round((b - a) / (30.44 * 24 * 3600 * 1000)));
          }
        }
        rows.push(
          <tr key={`${deal.id}-${row.catalogItemId}`}>
            <Td>A-{deal.id.slice(0, 8)}</Td>
            <Td>{t}</Td>
            <Td>{deal.buyer.legalName}</Td>
            <Td>{c0?.number ?? "—"}</Td>
            <Td>{dealStageLabel(deal.stage)}</Td>
            <Td>—</Td>
            <Td>—</Td>
            <Td>{licStart}</Td>
            <Td>{licEnd}</Td>
            <Td>{termMonths}</Td>
            <Td>{territory}</Td>
            <Td>{langStr}</Td>
            <Td>{rs ? platformsToRightsAcquired(rs.platforms) : "—"}</Td>
            <Td>{rs ? exclusivityTemplate(rs.exclusivity) : "—"}</Td>
            <Td>—</Td>
            <Td>—</Td>
            <Td>{gross}</Td>
            <Td>—</Td>
            <Td>{deal.currency}</Td>
            <Td>—</Td>
            <Td>—</Td>
            <Td>—</Td>
            <Td>—</Td>
            <Td>—</Td>
            <Td>—</Td>
            <Td className="max-w-[14rem] truncate" title={deal.title}>
              {deal.title}
            </Td>
          </tr>,
        );
      }
    }
    return rows;
  }, [deals, catalog, contractsByDealId]);

  const salesRows = useMemo(() => {
    const rows: React.ReactNode[] = [];
    for (const deal of deals.filter((d) => d.kind === "sale")) {
      for (const row of deal.catalogItems) {
        const rs = parseRs(row.rightsSelection);
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
        const langs =
          tid?.licenseTerms
            ?.flatMap((lt) => lt.languageRights ?? [])
            .filter(Boolean) ?? [];
        const langStr = [...new Set(langs)].join("; ") || "—";
        const licStart = rs?.startAt ? rs.startAt.slice(0, 10) : "—";
        const licEnd = rs?.endAt ? rs.endAt.slice(0, 10) : "—";
        let termMonths = "—";
        if (rs?.startAt && rs?.endAt) {
          const a = new Date(rs.startAt).getTime();
          const b = new Date(rs.endAt).getTime();
          if (Number.isFinite(a) && Number.isFinite(b) && b > a) {
            termMonths = String(Math.round((b - a) / (30.44 * 24 * 3600 * 1000)));
          }
        }
        rows.push(
          <tr key={`${deal.id}-${row.catalogItemId}`}>
            <Td>S-{deal.id.slice(0, 8)}</Td>
            <Td>{t}</Td>
            <Td>P-{deal.buyer.id.slice(0, 6)}</Td>
            <Td>{deal.buyer.legalName}</Td>
            <Td>{deal.buyer.country === "KZ" ? "Резидент" : "Нерезидент"}</Td>
            <Td>{dealStageLabel(deal.stage)}</Td>
            <Td>{c0?.number ?? "—"}</Td>
            <Td>—</Td>
            <Td>{licStart}</Td>
            <Td>{licEnd}</Td>
            <Td>{termMonths}</Td>
            <Td>{territory}</Td>
            <Td>{langStr}</Td>
            <Td>{rs ? platformsToRightsAcquired(rs.platforms) : "—"}</Td>
            <Td>{rs ? exclusivityTemplate(rs.exclusivity) : "—"}</Td>
            <Td>—</Td>
            <Td>—</Td>
            <Td>{fee}</Td>
            <Td>—</Td>
            <Td>—</Td>
            <Td>{deal.currency}</Td>
            <Td>—</Td>
            <Td>—</Td>
            <Td>—</Td>
            <Td>—</Td>
            <Td>—</Td>
            <Td className="max-w-[14rem] truncate" title={deal.title}>
              {deal.title}
            </Td>
          </tr>,
        );
      }
    }
    return rows;
  }, [deals, catalog, contractsByDealId]);

  if (loading) {
    return (
      <div className="p-8 text-sm text-muted-foreground">Загрузка базы прав…</div>
    );
  }

  return (
    <div className="space-y-4">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-foreground">База прав</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Структура по шаблону «База прав»: вкладки и колонки как в документе. Данные
          подставляются из каталога, сделок, контрагентов и договоров в CRM.
        </p>
      </motion.div>

      {err ? (
        <p className="text-sm text-destructive whitespace-pre-wrap">{err}</p>
      ) : null}

      <Tabs defaultValue="titles" className="w-full gap-4">
        <TabsList className="flex h-auto w-full max-w-full flex-wrap justify-start gap-1 rounded-xl bg-muted p-1">
          <TabsTrigger value="readme" className="text-xs sm:text-sm">
            Описание
          </TabsTrigger>
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

        <TabsContent value="readme" className="mt-0">
          <div className="rounded-xl border border-border bg-card p-5 text-sm leading-relaxed text-foreground">
            {README_LINES.map((line, i) => (
              <p key={i} className={line === "" ? "h-2" : ""}>
                {line}
              </p>
            ))}
          </div>
        </TabsContent>

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
                <Th>Срок (мес.)</Th>
                <Th>Территория</Th>
                <Th>Языковые права</Th>
                <Th>Приобретённые права</Th>
                <Th>Эксклюзивность</Th>
                <Th>Окно/холдбэк</Th>
                <Th>Модель оплаты</Th>
                <Th>Лицензионный платеж/MG</Th>
                <Th>Доля выручки, %</Th>
                <Th>Валюта</Th>
                <Th>Налоги/удержания</Th>
                <Th>Статус инвойса</Th>
                <Th>Условия оплаты</Th>
                <Th>Оплачено</Th>
                <Th>Остаток к оплате</Th>
                <Th>Срок поставки материалов</Th>
                <Th>Примечания (сделка)</Th>
              </tr>
            </thead>
            <tbody>
              {acquisitionRows.length ? (
                acquisitionRows
              ) : (
                <tr>
                  <Td colSpan={26} className="text-muted-foreground">
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
                <Th>Срок (мес.)</Th>
                <Th>Проданная территория</Th>
                <Th>Проданные языки</Th>
                <Th>Проданные права</Th>
                <Th>Эксклюзивность</Th>
                <Th>Позиция окна</Th>
                <Th>Модель оплаты</Th>
                <Th>Лицензионный платеж/MG</Th>
                <Th>Доля выручки, %</Th>
                <Th>Минимальная гарантия</Th>
                <Th>Валюта</Th>
                <Th>Частота отчётности</Th>
                <Th>Условия оплаты</Th>
                <Th>Статус инвойса</Th>
                <Th>Сумма по инвойсам</Th>
                <Th>Примечания</Th>
              </tr>
            </thead>
            <tbody>
              {salesRows.length ? (
                salesRows
              ) : (
                <tr>
                  <Td colSpan={26} className="text-muted-foreground">
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
                <Th>Бизнес-модель</Th>
                <Th>Ключевые территории</Th>
                <Th>Основные языки</Th>
                <Th>Портрет аудитории</Th>
                <Th>Предпочитаемые жанры</Th>
                <Th>Готовность к эксклюзиву</Th>
                <Th>Предпочтительный срок</Th>
                <Th>Средний бюджет</Th>
                <Th>Платежная дисциплина</Th>
                <Th>Тех. требования</Th>
                <Th>Требования к метаданным</Th>
                <Th>Ожидания по промо</Th>
                <Th>Требования к отчётности</Th>
                <Th>Основной контакт</Th>
                <Th>Эл. почта</Th>
                <Th>Телефон</Th>
                <Th>Примечания</Th>
              </tr>
            </thead>
            <tbody>
              {orgs.map((o) => (
                <tr key={o.id}>
                  <Td>P-{o.id.slice(0, 6)}</Td>
                  <Td>{o.legalName}</Td>
                  <Td>{o.legalName}</Td>
                  <Td>клиент (CRM)</Td>
                  <Td>—</Td>
                  <Td>{dealTerritoryLabel(o.country)}</Td>
                  <Td>—</Td>
                  <Td>—</Td>
                  <Td>—</Td>
                  <Td>—</Td>
                  <Td>—</Td>
                  <Td>—</Td>
                  <Td>—</Td>
                  <Td>—</Td>
                  <Td>—</Td>
                  <Td>—</Td>
                  <Td>—</Td>
                  <Td>—</Td>
                  <Td>—</Td>
                  <Td>—</Td>
                  <Td>—</Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        </TabsContent>

        <TabsContent value="deliverables" className="mt-0">
          <p className="text-xs text-muted-foreground mb-2">
            Полный учёт материалов по шаблону. В CRM пока нет статусов по каждому
            файлу — колонки выведены; заполнение из сервиса добавим позже.
          </p>
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
                <Th>Музыкальный cue sheet</Th>
                <Th>Сертификат цензуры/рейтинга</Th>
                <Th>Документ цепочки прав</Th>
                <Th>E&O (страховка)</Th>
                <Th>QC завершён</Th>
                <Th>Источник поставки</Th>
                <Th>Ссылка/путь к файлу</Th>
                <Th>Статус материалов</Th>
                <Th>Отсутствующие элементы</Th>
                <Th>Примечания</Th>
              </tr>
            </thead>
            <tbody>
              {catalog.map((item) => {
                const dash = "—";
                return (
                  <tr key={item.id}>
                    <Td>{titleId(item)}</Td>
                    <Td>{dash}</Td>
                    <Td>{dash}</Td>
                    <Td>{dash}</Td>
                    <Td>{dash}</Td>
                    <Td>{dash}</Td>
                    <Td>{dash}</Td>
                    <Td>{item.posterFileName ? "есть постер" : dash}</Td>
                    <Td>{dash}</Td>
                    <Td>{dash}</Td>
                    <Td>{dash}</Td>
                    <Td>{dash}</Td>
                    <Td>{dash}</Td>
                    <Td>{dash}</Td>
                    <Td>{dash}</Td>
                    <Td>{dash}</Td>
                    <Td>{dash}</Td>
                    <Td>{dash}</Td>
                    <Td>нет данных</Td>
                    <Td>{dash}</Td>
                  </tr>
                );
              })}
            </tbody>
          </TableShell>
        </TabsContent>

        <TabsContent value="dict" className="mt-0">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="text-sm font-semibold mb-2">Типы прав</h3>
              <TableShell>
                <thead>
                  <tr>
                    <Th>Код</Th>
                    <Th>Описание</Th>
                  </tr>
                </thead>
                <tbody>
                  {DICTIONARIES.rightsTypes.map(([a, b]) => (
                    <tr key={a}>
                      <Td>{a}</Td>
                      <Td>{b}</Td>
                    </tr>
                  ))}
                </tbody>
              </TableShell>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="text-sm font-semibold mb-2">Эксклюзивность</h3>
              <TableShell>
                <thead>
                  <tr>
                    <Th>Значение</Th>
                    <Th>Смысл</Th>
                  </tr>
                </thead>
                <tbody>
                  {DICTIONARIES.exclusivity.map(([a, b]) => (
                    <tr key={a}>
                      <Td>{a}</Td>
                      <Td>{b}</Td>
                    </tr>
                  ))}
                </tbody>
              </TableShell>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="text-sm font-semibold mb-2">Модели оплаты</h3>
              <TableShell>
                <thead>
                  <tr>
                    <Th>Модель</Th>
                    <Th>Описание</Th>
                  </tr>
                </thead>
                <tbody>
                  {DICTIONARIES.paymentModels.map(([a, b]) => (
                    <tr key={a}>
                      <Td>{a}</Td>
                      <Td>{b}</Td>
                    </tr>
                  ))}
                </tbody>
              </TableShell>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="text-sm font-semibold mb-2">Территории / языки</h3>
              <TableShell>
                <thead>
                  <tr>
                    <Th>Код территории</Th>
                    <Th>Территория</Th>
                    <Th>Код языка</Th>
                    <Th>Язык</Th>
                  </tr>
                </thead>
                <tbody>
                  {DICTIONARIES.territories.map(([tc, tn], i) => {
                    const lang = DICTIONARIES.languages[i] ?? ["—", "—"];
                    return (
                      <tr key={tc}>
                        <Td>{tc}</Td>
                        <Td>{tn}</Td>
                        <Td>{lang[0]}</Td>
                        <Td>{lang[1]}</Td>
                      </tr>
                    );
                  })}
                </tbody>
              </TableShell>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
