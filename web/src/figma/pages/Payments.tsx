"use client";

import { toast } from "sonner";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { v1Fetch } from "@/lib/v1-client";
import { tr } from "@/lib/i18n";
import { formatMoneyAmount } from "@/lib/format-money";
import { Button } from "@/figma/components/ui/button";
import { Input } from "@/figma/components/ui/input";
import { Label } from "@/figma/components/ui/label";
import {
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertTriangle,
  Download,
  Calendar,
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  List,
} from "lucide-react";
import { cn } from "@/figma/components/ui/utils";

type PaymentStats = {
  inboundPaidTotal: string;
  inboundPaidCount: number;
  inboundPendingTotal: string;
  inboundPendingCount: number;
  inboundOverdueTotal: string;
  inboundOverdueCount: number;
  outboundOverdueTotal: string;
  outboundOverdueCount: number;
  payoutsNetTotal: string;
  payoutsCount: number;
};

type PaymentRow = {
  id: string;
  dealId: string | null;
  contractId: string | null;
  direction: "inbound" | "outbound";
  amount: string;
  currency: string;
  withholdingTaxAmount: string | null;
  netAmount: string | null;
  dueAt: string | null;
  paidAt: string | null;
  status: string;
  deal: {
    id: string;
    title: string;
    kind: string;
    buyer: { legalName: string; country: string };
  } | null;
  contract: { id: string; number: string } | null;
};

type PayoutRow = {
  id: string;
  amountNet: string;
  currency: string;
  createdAt: string;
  rightsHolder: { legalName: string; country: string };
  contract: {
    number: string;
    deal: { id: string; title: string } | null;
  };
};

const statusLabels: Record<string, string> = {
  pending: tr("crm", "paymentStatusPending"),
  partially_paid: tr("crm", "paymentStatusPartiallyPaid"),
  paid: tr("crm", "paymentStatusPaid"),
  overdue: tr("crm", "paymentStatusOverdue"),
  cancelled: tr("crm", "paymentStatusCancelled"),
};

const statusStyle: Record<string, string> = {
  pending: "bg-warning/15 text-warning border border-warning/30",
  partially_paid: "bg-primary/15 text-primary border border-primary/30",
  paid: "bg-success/15 text-success border border-success/30",
  overdue: "bg-destructive/15 text-destructive border border-destructive/30",
  cancelled: "bg-muted text-muted-foreground border border-border",
};

import { fmtDate } from "@/lib/format-date";

export function Payments() {
  const searchParams = useSearchParams();
  const presetDealId = searchParams.get("dealId") ?? "";

  const [mainTab, setMainTab] = useState<
    "all" | "inbound" | "outbound" | "payouts"
  >("all");
  const [stats, setStats] = useState<PaymentStats | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<string>("");
  const [dealKindFilter, setDealKindFilter] = useState<"" | "purchase" | "sale">(
    "",
  );
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);

  const loadStats = useCallback(async () => {
    try {
      const s = await v1Fetch<PaymentStats>("/finance/payments/stats");
      setStats(s);
    } catch {
      setStats(null);
    }
  }, []);

  const fetchPayments = useCallback(
    async (direction?: "inbound" | "outbound") => {
      setLoading(true);
      setErr(null);
      try {
        const params = new URLSearchParams();
        if (direction) params.set("direction", direction);
        if (presetDealId) params.set("dealId", presetDealId);
        if (statusFilter) params.set("status", statusFilter);
        if (dealKindFilter) params.set("dealKind", dealKindFilter);
        if (debouncedQ) params.set("q", debouncedQ);
        if (from) params.set("from", from);
        if (to) params.set("to", to);
        const rows = await v1Fetch<PaymentRow[]>(
          `/finance/payments?${params.toString()}`,
        );
        setPayments(rows);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Ошибка загрузки");
        setPayments([]);
      } finally {
        setLoading(false);
      }
    },
    [presetDealId, statusFilter, dealKindFilter, debouncedQ, from, to],
  );

  const loadPayments = useCallback(async () => {
    if (mainTab === "payouts") return;
    if (mainTab === "all") await fetchPayments();
    else await fetchPayments(mainTab);
  }, [mainTab, fetchPayments]);

  const loadPayouts = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const rows = await v1Fetch<PayoutRow[]>("/finance/payouts");
      setPayouts(rows);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка загрузки выплат");
      setPayouts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  useEffect(() => {
    if (mainTab === "payouts") void loadPayouts();
    else void loadPayments();
  }, [mainTab, loadPayments, loadPayouts]);

  async function patchPayment(id: string, body: Record<string, unknown>) {
    setErr(null);
    try {
      await v1Fetch(`/finance/payments/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      toast.success("Платёж обновлён");
      await loadStats();
      if (mainTab !== "payouts") await loadPayments();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка сохранения");
      setErr(e instanceof Error ? e.message : "Ошибка сохранения");
    }
  }

  const exportCsv = useCallback(() => {
    if (mainTab === "payouts") {
      const head = [
        "id",
        "rightsHolder",
        "contract",
        "deal",
        "net",
        "currency",
        "createdAt",
      ];
      const lines = payouts.map((p) =>
        [
          p.id,
          p.rightsHolder.legalName,
          p.contract.number,
          p.contract.deal?.title ?? "",
          p.amountNet,
          p.currency,
          p.createdAt,
        ]
          .map((c) => `"${String(c).replace(/"/g, '""')}"`)
          .join(","),
      );
      const blob = new Blob([head.join(",") + "\n" + lines.join("\n")], {
        type: "text/csv;charset=utf-8",
      });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `payouts-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
      return;
    }
    const head = [
      "id",
      "direction",
      "deal",
      "buyer",
      "contract",
      "amount",
      "withholding",
      "net",
      "currency",
      "dueAt",
      "paidAt",
      "status",
    ];
    const lines = payments.map((p) =>
      [
        p.id,
        p.direction,
        p.deal?.title ?? "",
        p.deal?.buyer.legalName ?? "",
        p.contract?.number ?? "",
        p.amount,
        p.withholdingTaxAmount ?? "",
        p.netAmount ?? "",
        p.currency,
        p.dueAt ?? "",
        p.paidAt ?? "",
        p.status,
      ]
        .map((c) => `"${String(c).replace(/"/g, '""')}"`)
        .join(","),
    );
    const blob = new Blob([head.join(",") + "\n" + lines.join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `payments-${mainTab}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [mainTab, payments, payouts]);

  const kpiCards = useMemo(() => {
    if (!stats) return [];
    return [
      {
        label: "Ожидают поступления от площадок",
        value: stats.inboundPendingTotal,
        sub: `${stats.inboundPendingCount} счетов`,
        icon: Clock,
        color: "bg-warning/15",
        iconColor: "text-warning",
      },
      {
        label: "Получено (от Площадок)",
        value: stats.inboundPaidTotal,
        sub: `${stats.inboundPaidCount} платежей`,
        icon: DollarSign,
        color: "bg-success/15",
        iconColor: "text-success",
      },
      {
        label: "Оплачено правообладателю",
        value: stats.payoutsNetTotal,
        sub: `${stats.payoutsCount} выплат`,
        icon: TrendingUp,
        color: "bg-primary/15",
        iconColor: "text-primary",
      },
      {
        label: "Просрочки платежа входящие",
        value: stats.inboundOverdueTotal,
        sub: `${stats.inboundOverdueCount} шт.`,
        icon: AlertTriangle,
        color: "bg-destructive/15",
        iconColor: "text-destructive",
      },
      {
        label: "Просрочки платежа исходящие",
        value: stats.outboundOverdueTotal,
        sub: `${stats.outboundOverdueCount} шт.`,
        icon: AlertTriangle,
        color: "bg-destructive/15",
        iconColor: "text-destructive",
      },
    ];
  }, [stats]);

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap items-start justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-1">
            {tr("crm", "paymentsTitle")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {tr("crm", "paymentsSubtitle")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => void exportCsv()}>
            <Download className="size-4 mr-2" />
            {tr("crm", "paymentsExportCsv")}
          </Button>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        {kpiCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={cn(
                "rounded-lg border border-border bg-card p-5 hover:shadow-md transition-all",
                stat.color,
              )}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div
                    className={cn(
                      "p-2.5 rounded bg-card shadow-sm",
                      stat.iconColor,
                    )}
                  >
                    <Icon className="size-[22px]" strokeWidth={2.5} />
                  </div>
                  <span className="text-xs text-muted-foreground font-semibold">
                    {stat.sub}
                  </span>
                </div>
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                    {stat.label}
                  </p>
                  <p
                    className="text-2xl font-bold mt-1 text-foreground"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {`${formatMoneyAmount(stat.value)} \u20B8`}
                  </p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border pb-2">
        <Button
          type="button"
          variant={mainTab === "all" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setMainTab("all")}
        >
          <List className="size-4 mr-1" />
          {tr("crm", "paymentsTabAll")}
        </Button>
        <Button
          type="button"
          variant={mainTab === "inbound" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setMainTab("inbound")}
        >
          <ArrowDownLeft className="size-4 mr-1" />
          {tr("crm", "paymentsTabInbound")}
        </Button>
        <Button
          type="button"
          variant={mainTab === "outbound" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setMainTab("outbound")}
        >
          <ArrowUpRight className="size-4 mr-1" />
          {tr("crm", "paymentsTabOutbound")}
        </Button>
        <Button
          type="button"
          variant={mainTab === "payouts" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setMainTab("payouts")}
        >
          <Wallet className="size-4 mr-1" />
          {tr("crm", "paymentsTabPayouts")}
        </Button>
      </div>

      {mainTab !== "payouts" ? (
        <div className="flex flex-wrap gap-3 items-end rounded-lg border border-border bg-card p-4">
          <div className="space-y-1">
            <Label className="text-xs">{tr("crm", "paymentsFilterStatus")}</Label>
            <select
              className="w-[180px] rounded-md border border-border/50 bg-input-background px-3 py-2 text-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">{tr("crm", "paymentsFilterAll")}</option>
              <option value="pending">{tr("crm", "paymentStatusPending")}</option>
              <option value="partially_paid">{tr("crm", "paymentStatusPartiallyPaid")}</option>
              <option value="paid">{tr("crm", "paymentStatusPaid")}</option>
              <option value="overdue">{tr("crm", "paymentStatusOverdue")}</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">
              {tr("crm", "paymentsFilterDealCounterparty")}
            </Label>
            <select
              className="w-[200px] rounded-md border border-border/50 bg-input-background px-3 py-2 text-sm"
              value={dealKindFilter}
              onChange={(e) =>
                setDealKindFilter(
                  e.target.value as "" | "purchase" | "sale",
                )
              }
            >
              <option value="">{tr("crm", "paymentsFilterAllTypes")}</option>
              <option value="purchase">{tr("crm", "paymentsFilterPurchase")}</option>
              <option value="sale">{tr("crm", "paymentsFilterSale")}</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{tr("crm", "paymentsFilterSearch")}</Label>
            <Input
              placeholder={tr("crm", "paymentsFilterPlaceholder")}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-[220px]"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{tr("crm", "paymentsFilterFrom")}</Label>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{tr("crm", "paymentsFilterTo")}</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void loadPayments()}
          >
            {tr("crm", "paymentsRefresh")}
          </Button>
        </div>
      ) : null}

      {err && (
        <p className="text-sm text-destructive whitespace-pre-wrap">{err}</p>
      )}

      {mainTab !== "payouts" ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-lg bg-card border border-border overflow-hidden shadow-sm"
        >
          <div className="px-6 py-4 border-b border-border bg-muted/30">
            <h3 className="text-base font-bold text-foreground uppercase tracking-wide">
              {mainTab === "all"
                ? tr("crm", "paymentsSectionAll")
                : mainTab === "inbound"
                  ? tr("crm", "paymentsSectionInbound")
                  : tr("crm", "paymentsSectionOutbound")}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              {presetDealId
                ? tr("crm", "paymentsPresetHint")
                : tr("crm", "paymentsDefaultHint")}
            </p>
          </div>
          <div className="overflow-x-auto">
            {loading ? (
              <p className="p-6 text-sm text-muted-foreground">
                {tr("crm", "paymentsLoading")}
              </p>
            ) : (
              <table className="w-full">
                <thead className="bg-muted/50 border-b-2 border-border">
                  <tr>
                    <th className="text-left px-6 py-3 text-xs font-bold uppercase">
                      ID
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-bold uppercase">
                      {tr("crm", "paymentsColType")}
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-bold uppercase">
                      {tr("crm", "paymentsFilterDealCounterparty")}
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-bold uppercase">
                      {tr("crm", "paymentsColAmount")}
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-bold uppercase">
                      {tr("crm", "paymentsColWithholding")}
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-bold uppercase">
                      Net
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-bold uppercase">
                      {tr("crm", "paymentsColDue")}
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-bold uppercase">
                      {tr("crm", "paymentsFilterStatus")}
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-bold uppercase">
                      {tr("crm", "paymentsColActions")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {payments.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12">
                        <div className="flex flex-col items-center gap-2 text-center">
                          <Wallet className="size-8 text-muted-foreground/40" />
                          <p className="text-sm font-medium text-muted-foreground">
                            {tr("crm", "paymentsEmptyTitle")}
                          </p>
                          <p className="text-xs text-muted-foreground/70">
                            {tr("crm", "paymentsEmptyDescription")}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    payments.map((payment) => {
                      const st =
                        statusStyle[payment.status] ?? statusStyle.pending;
                      const StatusIcon =
                        payment.status === "paid"
                          ? CheckCircle
                          : payment.status === "overdue"
                            ? AlertTriangle
                            : Clock;
                      return (
                        <tr
                          key={payment.id}
                          className="border-b border-border hover:bg-muted/30"
                        >
                          <td className="px-6 py-4">
                            <span
                              className="text-xs font-mono"
                              title={payment.id}
                            >
                              {payment.id.slice(0, 8)}…
                            </span>
                          </td>
                          <td className="px-6 py-4 text-xs text-muted-foreground">
                            {payment.direction === "inbound"
                              ? tr("crm", "paymentsDirectionInbound")
                              : payment.direction === "outbound"
                                ? tr("crm", "paymentsDirectionOutbound")
                                : payment.direction}
                          </td>
                          <td className="px-6 py-4">
                            <div>
                              {payment.deal ? (
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                  <Link
                                    href={`/deals/${payment.deal.id}`}
                                    className="font-semibold text-sm text-primary hover:underline"
                                  >
                                    {payment.deal.title}
                                  </Link>
                                  <span className="text-[10px] uppercase font-bold text-muted-foreground border border-border rounded px-1 py-px">
                                    {payment.deal.kind === "purchase"
                                      ? "Покупка"
                                      : payment.deal.kind === "sale"
                                        ? "Продажа"
                                        : payment.deal.kind}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-sm">—</span>
                              )}
                              <p className="text-xs text-muted-foreground">
                                {payment.deal?.buyer.legalName ?? "—"}
                                {payment.contract
                                  ? ` · ${payment.contract.number}`
                                  : ""}
                              </p>
                            </div>
                          </td>
                          <td className="px-6 py-4 font-mono text-sm font-bold">
                            {formatMoneyAmount(payment.amount)} {payment.currency}
                          </td>
                          <td className="px-6 py-4 text-sm text-muted-foreground font-mono">
                            {payment.withholdingTaxAmount
                              ? formatMoneyAmount(payment.withholdingTaxAmount)
                              : "—"}
                          </td>
                          <td className="px-6 py-4 font-mono text-sm font-bold">
                            {payment.netAmount
                              ? formatMoneyAmount(payment.netAmount)
                              : "—"}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Calendar className="size-3" />
                              {fmtDate(payment.dueAt)}
                            </div>
                            {payment.paidAt ? (
                              <p className="text-[11px] text-muted-foreground mt-0.5">
                                {tr("crm", "paymentsPaidAtPrefix")}{" "}
                                {fmtDate(payment.paidAt)}
                              </p>
                            ) : null}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold",
                                st,
                              )}
                            >
                              <StatusIcon className="size-3" />
                              {statusLabels[payment.status] ?? payment.status}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-wrap gap-1">
                              {payment.status !== "paid" &&
                              payment.status !== "cancelled" ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() =>
                                    void patchPayment(payment.id, {
                                      status: "paid",
                                    })
                                  }
                                >
                                  {tr("crm", "paymentsActionPaid")}
                                </Button>
                              ) : null}
                              {payment.status === "pending" ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() =>
                                    void patchPayment(payment.id, {
                                      status: "partially_paid",
                                    })
                                  }
                                >
                                  {tr("crm", "paymentsActionPartial")}
                                </Button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}
          </div>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-lg bg-card border border-border overflow-hidden shadow-sm"
        >
          <div className="px-6 py-4 border-b border-border bg-muted/30 flex flex-wrap justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-foreground uppercase tracking-wide">
                {tr("crm", "payoutsTitle")}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                {tr("crm", "payoutsSubtitle")}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void loadPayouts()}
            >
              {tr("crm", "paymentsRefresh")}
            </Button>
          </div>
          <div className="overflow-x-auto">
            {loading ? (
              <p className="p-6 text-sm text-muted-foreground">
                {tr("crm", "paymentsLoading")}
              </p>
            ) : (
              <table className="w-full">
                <thead className="bg-muted/50 border-b-2 border-border">
                  <tr>
                    <th className="text-left px-6 py-3 text-xs font-bold uppercase">
                      {tr("crm", "payoutsColHolder")}
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-bold uppercase">
                      {tr("crm", "payoutsColContractDeal")}
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-bold uppercase">
                      Net
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-bold uppercase">
                      {tr("crm", "payoutsColDate")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {payouts.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-12">
                        <div className="flex flex-col items-center gap-2 text-center">
                          <TrendingUp className="size-8 text-muted-foreground/40" />
                          <p className="text-sm font-medium text-muted-foreground">
                            {tr("crm", "payoutsEmptyTitle")}
                          </p>
                          <p className="text-xs text-muted-foreground/70">
                            {tr("crm", "payoutsEmptyDescription")}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    payouts.map((p) => (
                      <tr
                        key={p.id}
                        className="border-b border-border hover:bg-muted/30"
                      >
                        <td className="px-6 py-4">
                          <p className="font-semibold text-sm">
                            {p.rightsHolder.legalName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {p.rightsHolder.country}
                          </p>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <span className="font-mono">{p.contract.number}</span>
                          {p.contract.deal ? (
                            <Link
                              href={`/deals/${p.contract.deal.id}`}
                              className="block text-xs text-primary hover:underline mt-0.5"
                            >
                              {p.contract.deal.title}
                            </Link>
                          ) : null}
                        </td>
                        <td className="px-6 py-4 font-mono font-bold">
                          {formatMoneyAmount(p.amountNet)} {p.currency}
                        </td>
                        <td className="px-6 py-4 text-xs text-muted-foreground">
                          {fmtDate(p.createdAt)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}
