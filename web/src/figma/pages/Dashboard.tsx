"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { tr } from "@/lib/i18n";
import { formatMoneyAmount } from "@/lib/format-money";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  FileText,
  Clock,
  RefreshCw,
  Film,
  ListTodo,
  AlertTriangle,
  ArrowRight,
  Minus,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  LineChart,
  Line,
} from "recharts";
import { v1Fetch } from "@/lib/v1-client";
import { Button } from "@/figma/components/ui/button";
import { cn } from "@/figma/components/ui/utils";

type Period = "30d" | "90d" | "1y";

type PaymentStats = {
  inboundPaidTotal: string;
  inboundPaidCount: number;
  inboundPendingTotal: string;
  inboundPendingCount: number;
  inboundOverdueTotal: string;
  inboundOverdueCount: number;
  outboundPendingTotal: string;
  outboundPendingCount: number;
  payoutsNetTotal: string;
  payoutsCount: number;
};

type ApiDeal = {
  id: string;
  title: string;
  kind?: string;
  stage: string;
  archived?: boolean;
  currency: string;
  updatedAt: string;
  createdAt: string;
  buyer: { legalName: string };
  commercialSnapshot: Record<string, unknown> | null;
  catalogItems: { catalogItem: { title: string } }[];
};

type ContractRow = {
  id: string;
  status: string;
  createdAt?: string;
  signedAt?: string;
  expiresAt?: string;
  counterpartyLegalName?: string;
  title?: string;
};

type CatalogRow = { id: string; status: string };

type TaskListResponse = {
  items: unknown[];
  total: number;
};

const STAGE_LABEL: Record<string, string> = {
  lead: "Лид",
  negotiation: "Переговоры",
  contract: "Контракт",
  paid: "Оплачено",
};

const STAGE_TABLE_CLASS: Record<string, string> = {
  lead: "text-info bg-info/15 border border-info/30",
  negotiation: "text-warning bg-warning/15 border border-warning/30",
  contract: "text-primary bg-primary/15 border border-primary/30",
  paid: "text-success bg-success/15 border border-success/30",
};

const PERIOD_DAYS: Record<Period, number> = { "30d": 30, "90d": 90, "1y": 365 };
const PERIOD_LABEL: Record<Period, string> = { "30d": "30 дней", "90d": "90 дней", "1y": "Год" };

function parseExpectedValue(
  snap: Record<string, unknown> | null,
): string | number | null {
  if (!snap) return null;
  const v = snap.expectedValue;
  if (typeof v === "number" || typeof v === "string") return v;
  return null;
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function daysDiff(dateStr: string): number {
  const now = Date.now();
  const t = new Date(dateStr).getTime();
  return Math.floor((now - t) / 86_400_000);
}

function periodStart(period: Period): Date {
  const d = new Date();
  d.setDate(d.getDate() - PERIOD_DAYS[period]);
  return d;
}

function DeltaBadge({
  current,
  previous,
}: {
  current: number;
  previous: number;
}) {
  if (previous === 0 && current === 0) return null;
  const diff = current - previous;
  if (diff === 0)
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-muted-foreground">
        <Minus className="size-2.5" />0
      </span>
    );
  const positive = diff > 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-[10px] font-semibold",
        positive ? "text-success" : "text-destructive",
      )}
    >
      {positive ? (
        <TrendingUp className="size-2.5" />
      ) : (
        <TrendingDown className="size-2.5" />
      )}
      {positive ? "+" : ""}
      {diff} vs пр.
    </span>
  );
}

export function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [payStats, setPayStats] = useState<PaymentStats | null>(null);
  const [deals, setDeals] = useState<ApiDeal[]>([]);
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [catalogItems, setCatalogItems] = useState<CatalogRow[]>([]);
  const [tasksOpen, setTasksOpen] = useState(0);
  const [tasksOverdue, setTasksOverdue] = useState(0);
  const [period, setPeriod] = useState<Period>("30d");

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const [
        ps,
        dl,
        ct,
        cat,
        todoR,
        progR,
        ovR,
      ] = await Promise.all([
        v1Fetch<PaymentStats>("/finance/payments/stats").catch(() => null),
        v1Fetch<ApiDeal[]>("/deals?limit=400").catch(() => []),
        v1Fetch<ContractRow[]>("/contracts?limit=400").catch(() => []),
        v1Fetch<CatalogRow[]>("/catalog/items").catch(() => []),
        v1Fetch<TaskListResponse>("/tasks?limit=1&status=todo").catch(() => ({
          items: [],
          total: 0,
        })),
        v1Fetch<TaskListResponse>("/tasks?limit=1&status=in_progress").catch(
          () => ({ items: [], total: 0 }),
        ),
        v1Fetch<TaskListResponse>("/tasks?limit=1&overdue=true").catch(() => ({
          items: [],
          total: 0,
        })),
      ]);
      setPayStats(ps);
      setDeals(Array.isArray(dl) ? dl : []);
      setContracts(Array.isArray(ct) ? ct : []);
      setCatalogItems(Array.isArray(cat) ? cat : []);
      setTasksOpen(
        (todoR?.total ?? 0) + (progR?.total ?? 0),
      );
      setTasksOverdue(ovR?.total ?? 0);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const activeDeals = useMemo(
    () => deals.filter((d) => !d.archived),
    [deals],
  );

  const dealsInPipeline = useMemo(
    () => activeDeals.filter((d) => d.stage !== "paid").length,
    [activeDeals],
  );

  const contractBreakdown = useMemo(() => {
    const signed = contracts.filter((c) => c.status === "signed").length;
    const sent = contracts.filter((c) => c.status === "sent").length;
    const draft = contracts.filter((c) => c.status === "draft").length;
    const expired = contracts.filter((c) => c.status === "expired").length;
    return { signed, sent, draft, expired };
  }, [contracts]);

  const catalogActive = useMemo(
    () => catalogItems.filter((i) => i.status !== "archived").length,
    [catalogItems],
  );

  // --- Period-based deltas ---
  const periodDeltas = useMemo(() => {
    const days = PERIOD_DAYS[period];
    const now = Date.now();
    const curStart = now - days * 86_400_000;
    const prevStart = curStart - days * 86_400_000;

    const dealsInCur = deals.filter((d) => {
      const t = new Date(d.createdAt).getTime();
      return t >= curStart;
    }).length;
    const dealsInPrev = deals.filter((d) => {
      const t = new Date(d.createdAt).getTime();
      return t >= prevStart && t < curStart;
    }).length;

    const contractsInCur = contracts.filter((c) => {
      if (!c.createdAt) return false;
      const t = new Date(c.createdAt).getTime();
      return t >= curStart;
    }).length;
    const contractsInPrev = contracts.filter((c) => {
      if (!c.createdAt) return false;
      const t = new Date(c.createdAt).getTime();
      return t >= prevStart && t < curStart;
    }).length;

    return {
      deals: { current: dealsInCur, previous: dealsInPrev },
      contracts: { current: contractsInCur, previous: contractsInPrev },
    };
  }, [deals, contracts, period]);

  // --- Attention items ---
  const attentionItems = useMemo(() => {
    const items: { type: string; label: string; href: string; detail: string }[] = [];

    // Stuck deals: no update for 14+ days
    const stuck = activeDeals.filter(
      (d) => d.stage !== "paid" && daysDiff(d.updatedAt) >= 14,
    );
    if (stuck.length > 0) {
      items.push({
        type: "deal",
        label: `${stuck.length} сделок без активности 14+ дней`,
        href: "/deals",
        detail: stuck
          .slice(0, 3)
          .map((d) => d.title)
          .join(", ") + (stuck.length > 3 ? " и др." : ""),
      });
    }

    // Contracts awaiting signature
    const awaitingSig = contracts.filter((c) => c.status === "sent");
    if (awaitingSig.length > 0) {
      items.push({
        type: "contract",
        label: `${awaitingSig.length} контрактов ожидают подписи`,
        href: "/contracts",
        detail: "Отправлены клиенту, но ещё не подписаны",
      });
    }

    // Expiring contracts within 60 days
    if (contracts.some((c) => c.expiresAt)) {
      const soon = Date.now() + 60 * 86_400_000;
      const expiring = contracts.filter((c) => {
        if (!c.expiresAt) return false;
        const t = new Date(c.expiresAt).getTime();
        return t > Date.now() && t <= soon;
      });
      if (expiring.length > 0) {
        items.push({
          type: "contract",
          label: `${expiring.length} контрактов истекают в ближайшие 60 дней`,
          href: "/contracts",
          detail: "Требуется продление или переговоры",
        });
      }
    }

    // Overdue payments
    if (payStats && Number(payStats.inboundOverdueCount) > 0) {
      items.push({
        type: "payment",
        label: `${payStats.inboundOverdueCount} просроченных входящих платежей`,
        href: "/payments",
        detail: `На сумму ${formatMoneyAmount(payStats.inboundOverdueTotal)} ₸`,
      });
    }

    return items;
  }, [activeDeals, contracts, payStats]);

  // --- Chart data based on period ---
  const newDealsByMonth = useMemo(() => {
    const monthCount = period === "30d" ? 6 : period === "90d" ? 9 : 12;
    const now = new Date();
    const buckets: { key: string; name: string; deals: number }[] = [];
    for (let i = monthCount - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({
        key: monthKey(d),
        name: d.toLocaleDateString("ru-RU", { month: "short" }),
        deals: 0,
      });
    }
    const keySet = new Set(buckets.map((b) => b.key));
    for (const deal of deals) {
      const c = new Date(deal.createdAt);
      if (Number.isNaN(c.getTime())) continue;
      const k = monthKey(c);
      if (keySet.has(k)) {
        const b = buckets.find((x) => x.key === k);
        if (b) b.deals += 1;
      }
    }
    return buckets.map(({ name, deals: n }) => ({ name, deals: n }));
  }, [deals, period]);

  const pipelineChartData = useMemo(() => {
    const order = ["lead", "negotiation", "contract", "paid"] as const;
    return order.map((stage) => ({
      name: STAGE_LABEL[stage] ?? stage,
      count: activeDeals.filter((d) => d.stage === stage).length,
    }));
  }, [activeDeals]);

  const recentDeals = useMemo(() => {
    return [...deals]
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      )
      .slice(0, 10);
  }, [deals]);

  const kpiCards = useMemo(() => {
    const pendingIn = payStats?.inboundPendingCount ?? 0;
    const overdueIn = payStats?.inboundOverdueCount ?? 0;
    return [
      {
        label: "Сделки в воронке",
        value: String(dealsInPipeline),
        sub: `Активных: ${activeDeals.length} · Оплачено: ${activeDeals.filter((d) => d.stage === "paid").length}`,
        delta: periodDeltas.deals,
        icon: TrendingUp,
        href: "/deals",
      },
      {
        label: "Ожидают оплаты",
        value: payStats
          ? `${formatMoneyAmount(payStats.inboundPendingTotal)} ₸`
          : "—",
        sub:
          pendingIn > 0
            ? `Счетов: ${pendingIn}${overdueIn ? ` · просрочено: ${overdueIn}` : ""}`
            : "Нет ожидающих поступлений",
        delta: null,
        icon: Clock,
        href: "/payments",
      },
      {
        label: "Получено (входящие)",
        value: payStats
          ? `${formatMoneyAmount(payStats.inboundPaidTotal)} ₸`
          : "—",
        sub: payStats ? `Платежей: ${payStats.inboundPaidCount}` : "Нет данных",
        delta: null,
        icon: DollarSign,
        href: "/payments",
      },
      {
        label: "Контракты",
        value: String(contracts.length),
        sub: `Подписано: ${contractBreakdown.signed} · На подписи: ${contractBreakdown.sent} · Черновики: ${contractBreakdown.draft}${contractBreakdown.expired ? ` · Неактуально: ${contractBreakdown.expired}` : ""}`,
        delta: periodDeltas.contracts,
        icon: FileText,
        href: "/contracts",
      },
      {
        label: "Каталог контента",
        value: String(catalogActive),
        sub: `Позиций не в архиве · всего: ${catalogItems.length}`,
        delta: null,
        icon: Film,
        href: "/content",
      },
      {
        label: "Задачи",
        value: String(tasksOpen),
        sub:
          tasksOverdue > 0
            ? `Открыто (к выполнению и в работе) · просрочено: ${tasksOverdue}`
            : "Открыто (к выполнению и в работе)",
        delta: null,
        icon: ListTodo,
        href: "/tasks",
      },
    ];
  }, [
    dealsInPipeline,
    activeDeals,
    payStats,
    contracts.length,
    contractBreakdown,
    catalogActive,
    catalogItems.length,
    tasksOpen,
    tasksOverdue,
    periodDeltas,
  ]);

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-1">
            {tr("crm", "dashboardTitle")}
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            {tr("crm", "dashboardSubtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Period selector */}
          <div className="flex rounded-md border border-border overflow-hidden text-xs font-semibold">
            {(["30d", "90d", "1y"] as Period[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={cn(
                  "px-3 py-1.5 transition-colors",
                  period === p
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-muted-foreground hover:bg-muted",
                )}
              >
                {PERIOD_LABEL[p]}
              </button>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => void load()}
          >
            <RefreshCw className={cn("size-4 mr-2", loading && "animate-spin")} />
            {tr("crm", "dashboardRefresh")}
          </Button>
        </div>
      </motion.div>

      {err ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {err}
        </div>
      ) : null}

      {/* Attention block — Task #26 */}
      {!loading && attentionItems.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-lg border border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 overflow-hidden"
        >
          <div className="px-4 py-2.5 border-b border-amber-500/25 bg-amber-500/10 flex items-center gap-2">
            <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="text-sm font-bold text-amber-800 dark:text-amber-200">
              Требуют внимания
            </span>
            <span className="ml-auto text-xs font-semibold text-amber-600 dark:text-amber-400">
              {attentionItems.length} {attentionItems.length === 1 ? "пункт" : attentionItems.length < 5 ? "пункта" : "пунктов"}
            </span>
          </div>
          <div className="divide-y divide-amber-500/15">
            {attentionItems.map((item, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                    {item.label}
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                    {item.detail}
                  </p>
                </div>
                <Link
                  href={item.href}
                  className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                >
                  Перейти
                  <ArrowRight className="size-3" />
                </Link>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Overdue banner */}
      {payStats &&
      (Number(payStats.inboundOverdueCount ?? 0) > 0 ||
        Number(payStats.outboundPendingCount ?? 0) > 0) &&
      attentionItems.length === 0 ? (
        <div className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100 flex flex-wrap items-center gap-2">
          <AlertTriangle className="size-4 shrink-0" />
          <span>
            {Number(payStats.inboundOverdueCount) > 0
              ? `Просроченных входящих: ${payStats.inboundOverdueCount} (${formatMoneyAmount(payStats.inboundOverdueTotal)} ₸). `
              : ""}
            {Number(payStats.outboundPendingCount) > 0
              ? `Исходящих к оплате: ${payStats.outboundPendingCount} (${formatMoneyAmount(payStats.outboundPendingTotal)} ₸).`
              : ""}
          </span>
          <Link
            href="/payments"
            className="inline-flex items-center gap-1 font-semibold text-primary hover:underline ml-auto"
          >
            Платежи
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      ) : null}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {kpiCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Link
                href={stat.href}
                className="block rounded-lg p-5 bg-card border border-border shadow-sm hover:shadow-md hover:border-primary/25 transition-all duration-200 h-full"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-11 h-11 rounded bg-primary flex items-center justify-center shadow-sm">
                    <Icon
                      size={22}
                      strokeWidth={2.5}
                      className="text-primary-foreground"
                    />
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {stat.delta && (
                      <DeltaBadge
                        current={stat.delta.current}
                        previous={stat.delta.previous}
                      />
                    )}
                    <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                      {tr("crm", "dashboardGoTo")}
                      <ArrowRight className="size-3" />
                    </span>
                  </div>
                </div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                  {stat.label}
                </p>
                <p
                  className="text-2xl font-bold text-foreground mb-2"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {loading ? "…" : stat.value}
                </p>
                <p className="text-xs text-muted-foreground leading-snug">
                  {stat.sub}
                </p>
              </Link>
            </motion.div>
          );
        })}
      </div>

      {payStats &&
      (Number(payStats.payoutsCount) > 0 ||
        Number.parseFloat(String(payStats.outboundPendingTotal || "0")) > 0) ? (
        <p className="text-xs text-muted-foreground px-1">
          Роялти: выплачено net{" "}
          <span className="font-mono font-semibold text-foreground">
            {formatMoneyAmount(payStats.payoutsNetTotal)}
            {" "}
            {"₸"}
          </span>
          {payStats.payoutsCount ? ` · ${payStats.payoutsCount} выплат` : ""}
          {Number.parseFloat(String(payStats.outboundPendingTotal || "0")) > 0
            ? ` · исходящие к оплате: ${formatMoneyAmount(payStats.outboundPendingTotal)} ₸`
            : ""}
          .{" "}
          <Link
            href="/payments"
            className="text-primary font-medium hover:underline"
          >
            Раздел платежей
          </Link>
        </p>
      ) : null}

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-2">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, type: "spring", damping: 20 }}
          className="rounded-lg border border-border bg-card p-6 shadow-sm"
        >
          <div className="mb-6 pb-3 border-b border-border">
            <h3 className="text-base font-bold text-foreground uppercase tracking-wide">
              Сделки по стадиям
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Только неархивные сделки
            </p>
          </div>
          {loading ? (
            <p className="text-sm text-muted-foreground py-12 text-center">
              {tr("crm", "dashboardLoading")}
            </p>
          ) : pipelineChartData.every((d) => d.count === 0) ? (
            <p className="text-sm text-muted-foreground py-12 text-center">
              Нет активных сделок для диаграммы
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={pipelineChartData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#cbd5e1"
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  stroke="#64748b"
                  style={{ fontSize: "11px", fontWeight: 600 }}
                />
                <YAxis
                  allowDecimals={false}
                  stroke="#64748b"
                  style={{ fontSize: "11px", fontWeight: 600 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#ffffff",
                    border: "2px solid #4a8b83",
                    borderRadius: "6px",
                    boxShadow: "0 4px 16px rgba(74, 139, 131, 0.18)",
                    color: "#1e3330",
                    fontWeight: 600,
                  }}
                  formatter={(value: number) => [value, "Сделок"]}
                />
                <Bar dataKey="count" fill="#4a8b83" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, type: "spring", damping: 20 }}
          className="rounded-lg border border-border bg-card p-6 shadow-sm"
        >
          <div className="mb-6 pb-3 border-b border-border flex items-start justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-foreground uppercase tracking-wide">
                Новые сделки по месяцам
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                По дате создания ·{" "}
                {period === "30d"
                  ? "последние 6 месяцев"
                  : period === "90d"
                    ? "последние 9 месяцев"
                    : "последние 12 месяцев"}
              </p>
            </div>
          </div>
          {loading ? (
            <p className="text-sm text-muted-foreground py-12 text-center">
              Загрузка…
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={newDealsByMonth}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#cbd5e1"
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  stroke="#64748b"
                  style={{ fontSize: "11px", fontWeight: 600 }}
                />
                <YAxis
                  allowDecimals={false}
                  stroke="#64748b"
                  style={{ fontSize: "11px", fontWeight: 600 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#ffffff",
                    border: "2px solid #69b0ac",
                    borderRadius: "6px",
                    boxShadow: "0 4px 16px rgba(105, 176, 172, 0.2)",
                    color: "#1e3330",
                    fontWeight: 600,
                  }}
                  formatter={(value: number) => [value, "Сделок"]}
                />
                <Line
                  type="monotone"
                  dataKey="deals"
                  stroke="#69b0ac"
                  strokeWidth={3}
                  dot={{
                    fill: "#69b0ac",
                    r: 5,
                    strokeWidth: 3,
                    stroke: "#ffffff",
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </motion.div>
      </div>

      {/* Recent deals table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, type: "spring", damping: 20 }}
        className="rounded-lg border border-border bg-card overflow-hidden shadow-sm"
      >
        <div className="px-6 py-4 border-b border-border bg-muted/30 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-foreground uppercase tracking-wide">
              Недавно обновлённые сделки
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Стадия, клиент и ожидаемая сумма из снимка сделки
            </p>
          </div>
          <Link
            href="/deals"
            className="text-sm font-semibold text-primary hover:underline inline-flex items-center gap-1"
          >
            Все сделки
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-border bg-muted/50">
                <th className="text-left px-6 py-3 text-xs font-bold text-foreground uppercase tracking-wider">
                  Клиент
                </th>
                <th className="text-left px-6 py-3 text-xs font-bold text-foreground uppercase tracking-wider">
                  Сделка
                </th>
                <th className="text-left px-6 py-3 text-xs font-bold text-foreground uppercase tracking-wider">
                  Стадия
                </th>
                <th className="text-right px-6 py-3 text-xs font-bold text-foreground uppercase tracking-wider">
                  Ожидаемо
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-6 py-8 text-sm text-muted-foreground text-center"
                  >
                    Загрузка…
                  </td>
                </tr>
              ) : recentDeals.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-6 py-8 text-sm text-muted-foreground text-center"
                  >
                    Сделок пока нет. Создайте первую в разделе «Сделки».
                  </td>
                </tr>
              ) : (
                recentDeals.map((deal, index) => {
                  const ev = parseExpectedValue(deal.commercialSnapshot);
                  const stage = deal.stage;
                  return (
                    <motion.tr
                      key={deal.id}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.05 + index * 0.02 }}
                      className="border-b border-border hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-6 py-4 font-semibold text-foreground">
                        {deal.buyer?.legalName ?? "—"}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <Link
                          href={`/deals/${deal.id}`}
                          className="text-primary font-medium hover:underline"
                        >
                          {deal.title}
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={cn(
                            "inline-flex px-2.5 py-1 rounded text-xs font-bold",
                            STAGE_TABLE_CLASS[stage] ??
                              "bg-muted text-muted-foreground border border-border",
                          )}
                        >
                          {STAGE_LABEL[stage] ?? stage}
                        </span>
                      </td>
                      <td
                        className="px-6 py-4 text-right font-bold text-foreground"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        {ev != null
                          ? `${formatMoneyAmount(ev)} ${deal.currency}`
                          : "—"}
                      </td>
                    </motion.tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
