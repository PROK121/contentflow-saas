"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import { v1Fetch } from "@/lib/v1-client";
import { formatMoneyAmount } from "@/lib/format-money";
import { cn } from "@/figma/components/ui/utils";
import {
  ChevronLeft,
  ChevronRight,
  X,
  Clock,
  AlertTriangle,
  CheckCircle,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
} from "lucide-react";

/* ─── Types ──────────────────────────────────────────────────────────── */
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
    currency: string;
    buyer: { id: string; legalName: string; country: string };
  } | null;
  contract: { id: string; number: string } | null;
};

type DirFilter = "all" | "inbound" | "outbound";

/* ─── Constants ──────────────────────────────────────────────────────── */
const MONTHS_RU = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

const DAYS_SHORT = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

const STATUS_LABELS: Record<string, string> = {
  pending: "Ожидается",
  partially_paid: "Частично",
  paid: "Оплачено",
  overdue: "Просрочено",
  cancelled: "Отменено",
};

const STATUS_PILL: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  partially_paid: "bg-blue-100 text-blue-700",
  paid: "bg-emerald-100 text-emerald-700",
  overdue: "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-500",
};

/* ─── Helpers ────────────────────────────────────────────────────────── */
function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function dayKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function pluralPayment(n: number): string {
  if (n % 10 === 1 && n % 100 !== 11) return "платёж";
  if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) return "платежа";
  return "платежей";
}

/* ─── Component ──────────────────────────────────────────────────────── */
export default function CashFlow() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-based
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [dirFilter, setDirFilter] = useState<DirFilter>("all");
  const [markingId, setMarkingId] = useState<string | null>(null);

  /* ── Month boundaries ── */
  const monthStart = useMemo(() => new Date(year, month, 1), [year, month]);
  const monthEnd = useMemo(() => new Date(year, month + 1, 0), [year, month]);

  /* ── Fetch ── */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        from: toIsoDate(monthStart),
        to: toIsoDate(monthEnd),
      });
      const data = await v1Fetch<PaymentRow[]>(`/finance/payments?${params}`);
      setPayments(Array.isArray(data) ? data : []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка загрузки платежей");
    } finally {
      setLoading(false);
    }
  }, [monthStart, monthEnd]);

  useEffect(() => {
    void load();
  }, [load]);

  /* ── Navigation ── */
  const prevMonth = () => {
    setSelectedDay(null);
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }
    else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    setSelectedDay(null);
    if (month === 11) { setYear((y) => y + 1); setMonth(0); }
    else setMonth((m) => m + 1);
  };

  /* ── Filtered payments by direction ── */
  const visiblePayments = useMemo(() => {
    if (dirFilter === "all") return payments;
    return payments.filter((p) => p.direction === dirFilter);
  }, [payments, dirFilter]);

  /* ── Group by day key ── */
  const byDay = useMemo(() => {
    const map = new Map<string, PaymentRow[]>();
    for (const p of visiblePayments) {
      const key = (p.dueAt ?? p.paidAt)?.slice(0, 10);
      if (!key) continue;
      const list = map.get(key) ?? [];
      list.push(p);
      map.set(key, list);
    }
    return map;
  }, [visiblePayments]);

  /* ── Month-level summary (all directions, pending/paid/overdue) ── */
  const stats = useMemo(() => {
    let pending = 0, paid = 0, overdue = 0;
    for (const p of payments) {
      if (p.direction !== "inbound") continue;
      const amt = parseFloat(p.amount) || 0;
      if (p.status === "pending" || p.status === "partially_paid") pending += amt;
      else if (p.status === "paid") paid += amt;
      else if (p.status === "overdue") overdue += amt;
    }
    return { pending, paid, overdue };
  }, [payments]);

  /* ── Calendar grid (Mon-first) ── */
  const calendarDays = useMemo(() => {
    const cells: (number | null)[] = [];
    const firstDow = (monthStart.getDay() + 6) % 7; // Mon = 0
    for (let i = 0; i < firstDow; i++) cells.push(null);
    for (let d = 1; d <= monthEnd.getDate(); d++) cells.push(d);
    // Pad to full weeks
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [monthStart, monthEnd]);

  /* ── Mark as paid ── */
  const markPaid = useCallback(async (id: string) => {
    setMarkingId(id);
    try {
      await v1Fetch(`/finance/payments/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "paid", paidAt: new Date().toISOString() }),
      });
      toast.success("Платёж отмечен как оплаченный");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setMarkingId(null);
    }
  }, [load]);

  const todayKey = toIsoDate(today);
  const selectedPayments = selectedDay ? (byDay.get(selectedDay) ?? []) : [];

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Main ── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

        {/* Header */}
        <div className="px-6 pt-6 pb-4 shrink-0 border-b border-[var(--glass-border)]">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h1 className="text-[22px] font-semibold text-foreground leading-tight">Кэш-флоу</h1>
              <p className="text-[13px] text-muted-foreground mt-0.5">Финансовый календарь платежей</p>
            </div>
            {/* Direction tabs */}
            <div className="flex items-center gap-1 bg-black/[0.04] rounded-[10px] p-1">
              {(["all", "inbound", "outbound"] as DirFilter[]).map((d) => (
                <button
                  key={d}
                  onClick={() => setDirFilter(d)}
                  className={cn(
                    "px-3 py-1.5 rounded-[8px] text-[12px] font-medium transition-colors",
                    dirFilter === d
                      ? "bg-white shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {d === "all" ? "Все" : d === "inbound" ? "Входящие" : "Исходящие"}
                </button>
              ))}
            </div>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3">
            <SummaryCard
              label="Ожидается"
              value={stats.pending}
              icon={<Clock className="h-4 w-4" />}
              colorClass="text-amber-500"
              bgClass="bg-amber-50"
            />
            <SummaryCard
              label="Получено"
              value={stats.paid}
              icon={<CheckCircle className="h-4 w-4" />}
              colorClass="text-emerald-600"
              bgClass="bg-emerald-50"
            />
            <SummaryCard
              label="Просрочено"
              value={stats.overdue}
              icon={<AlertTriangle className="h-4 w-4" />}
              colorClass="text-red-500"
              bgClass="bg-red-50"
            />
          </div>
        </div>

        {/* Month nav */}
        <div className="px-6 py-3 shrink-0 flex items-center gap-3">
          <button
            onClick={prevMonth}
            className="p-1.5 rounded-[8px] hover:bg-black/[0.04] text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Предыдущий месяц"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-[15px] font-semibold text-foreground min-w-[170px] text-center">
            {MONTHS_RU[month]} {year}
          </span>
          <button
            onClick={nextMonth}
            className="p-1.5 rounded-[8px] hover:bg-black/[0.04] text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Следующий месяц"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            onClick={() => void load()}
            disabled={loading}
            className="ml-1 p-1.5 rounded-[8px] hover:bg-black/[0.04] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
            aria-label="Обновить"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          </button>
        </div>

        {/* Calendar */}
        <div className="flex-1 overflow-auto px-6 pb-6">
          {/* Day-of-week header */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {DAYS_SHORT.map((d) => (
              <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground py-1 select-none">
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day, idx) => {
              if (!day) return <div key={`empty-${idx}`} className="min-h-[72px]" />;

              const key = dayKey(year, month, day);
              const dayPayments = byDay.get(key) ?? [];
              const isToday = key === todayKey;
              const isSelected = key === selectedDay;

              let inAmt = 0, outAmt = 0, hasOverdue = false;
              for (const p of dayPayments) {
                const amt = parseFloat(p.amount) || 0;
                if (p.direction === "inbound") inAmt += amt;
                else outAmt += amt;
                if (p.status === "overdue") hasOverdue = true;
              }

              return (
                <motion.button
                  key={key}
                  onClick={() => setSelectedDay(isSelected ? null : key)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  className={cn(
                    "relative rounded-[10px] border p-2 text-left transition-colors min-h-[72px] flex flex-col",
                    isSelected
                      ? "bg-[#1e3d32] border-[#1e3d32]"
                      : isToday
                      ? "border-[#2d9e75] bg-[#f0faf5]"
                      : dayPayments.length > 0
                      ? "border-[var(--glass-border)] bg-white hover:border-[#2d9e75]/50"
                      : "border-[var(--glass-border)] bg-white/50 hover:bg-white"
                  )}
                >
                  {/* Day number */}
                  <span className={cn(
                    "text-[11px] font-semibold leading-none",
                    isSelected ? "text-white" : isToday ? "text-[#1e3d32]" : "text-foreground/70"
                  )}>
                    {day}
                  </span>

                  {/* Overdue dot */}
                  {hasOverdue && !isSelected && (
                    <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-red-500" />
                  )}

                  {/* Amounts */}
                  {dayPayments.length > 0 && (
                    <div className="mt-auto pt-1 space-y-0.5">
                      {inAmt > 0 && (
                        <p className={cn(
                          "text-[9px] font-semibold truncate",
                          isSelected ? "text-emerald-300" : "text-emerald-600"
                        )}>
                          +{formatMoneyAmount(inAmt)}
                        </p>
                      )}
                      {outAmt > 0 && (
                        <p className={cn(
                          "text-[9px] font-semibold truncate",
                          isSelected ? "text-red-300" : "text-red-500"
                        )}>
                          −{formatMoneyAmount(outAmt)}
                        </p>
                      )}
                      <p className={cn(
                        "text-[8px]",
                        isSelected ? "text-white/50" : "text-muted-foreground"
                      )}>
                        {dayPayments.length} {pluralPayment(dayPayments.length)}
                      </p>
                    </div>
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Day detail panel ── */}
      <AnimatePresence>
        {selectedDay && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 340, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: "spring", damping: 26, stiffness: 220 }}
            className="border-l border-[var(--glass-border)] bg-white/90 backdrop-blur-sm shrink-0 flex flex-col overflow-hidden"
          >
            {/* Panel header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--glass-border)] shrink-0">
              <div>
                <p className="text-[13px] font-semibold text-foreground">
                  {new Date(selectedDay + "T12:00:00").toLocaleDateString("ru-RU", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {selectedPayments.length} {pluralPayment(selectedPayments.length)}
                </p>
              </div>
              <button
                onClick={() => setSelectedDay(null)}
                className="p-1 rounded-md hover:bg-black/[0.06] text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Закрыть панель"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Payment list */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {selectedPayments.length === 0 ? (
                <p className="text-center py-10 text-[12px] text-muted-foreground">
                  Нет платежей за этот день
                </p>
              ) : (
                selectedPayments.map((p) => (
                  <PaymentCard
                    key={p.id}
                    payment={p}
                    onMarkPaid={markPaid}
                    markingId={markingId}
                  />
                ))
              )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Summary card ───────────────────────────────────────────────────── */
function SummaryCard({
  label,
  value,
  icon,
  colorClass,
  bgClass,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  colorClass: string;
  bgClass: string;
}) {
  return (
    <div className="glass-card p-3 flex items-center gap-3">
      <div className={cn("h-8 w-8 rounded-[8px] flex items-center justify-center shrink-0", bgClass, colorClass)}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground mb-0.5">{label}</p>
        <p className="text-[15px] font-semibold text-foreground leading-tight">
          {formatMoneyAmount(value)}{" "}
          <span className="text-[11px] font-normal text-muted-foreground">USD</span>
        </p>
      </div>
    </div>
  );
}

/* ─── Payment card (side panel) ──────────────────────────────────────── */
function PaymentCard({
  payment: p,
  onMarkPaid,
  markingId,
}: {
  payment: PaymentRow;
  onMarkPaid: (id: string) => void;
  markingId: string | null;
}) {
  const canMarkPaid =
    p.status === "pending" || p.status === "overdue" || p.status === "partially_paid";

  return (
    <div className="rounded-[10px] border border-[var(--glass-border)] bg-white p-3 space-y-1.5">
      {/* Amount + status */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {p.direction === "inbound" ? (
            <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
          ) : (
            <ArrowUpRight className="h-3.5 w-3.5 text-red-500 shrink-0" />
          )}
          <span className="text-[13px] font-semibold text-foreground truncate">
            {formatMoneyAmount(p.netAmount ?? p.amount)}{" "}
            <span className="text-[11px] font-normal text-muted-foreground">{p.currency}</span>
          </span>
        </div>
        <span className={cn(
          "shrink-0 text-[9px] font-semibold px-2 py-0.5 rounded-full",
          STATUS_PILL[p.status] ?? "bg-gray-100 text-gray-600"
        )}>
          {STATUS_LABELS[p.status] ?? p.status}
        </span>
      </div>

      {/* Deal title */}
      {p.deal && (
        <p className="text-[11px] font-medium text-foreground truncate">{p.deal.title}</p>
      )}

      {/* Counterparty */}
      {p.deal && (
        <p className="text-[10px] text-muted-foreground truncate">{p.deal.buyer.legalName}</p>
      )}

      {/* Due date */}
      {p.dueAt && (
        <p className="text-[10px] text-muted-foreground">
          Срок:{" "}
          {new Date(p.dueAt).toLocaleDateString("ru-RU", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </p>
      )}

      {/* Contract */}
      {p.contract && (
        <p className="text-[10px] text-muted-foreground">
          Договор № {p.contract.number}
        </p>
      )}

      {/* Mark paid button */}
      {canMarkPaid && (
        <button
          onClick={() => onMarkPaid(p.id)}
          disabled={markingId === p.id}
          className="mt-1 w-full py-1.5 rounded-[8px] bg-[#1e3d32] text-white text-[11px] font-medium hover:bg-[#2d9e75] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {markingId === p.id ? "Сохранение…" : "Отметить оплаченным"}
        </button>
      )}
    </div>
  );
}
