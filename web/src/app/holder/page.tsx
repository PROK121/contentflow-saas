"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Film, Handshake, Wallet, FileText, ArrowUpRight } from "lucide-react";
import { v1Fetch } from "@/lib/v1-client";

interface Dashboard {
  financeVisibility: "limited" | "full";
  titlesCount: number;
  activeDealsCount: number;
  pendingContractsCount: number;
  payoutsCount: number;
  /// В режиме `limited` равно null, в `full` — строка с суммой.
  payoutsTotal: string | null;
  lastPayout:
    | { at: string; currency: string; amount?: string }
    | null;
}

function fmtMoney(amount: string, currency = ""): string {
  const num = Number(amount);
  if (Number.isNaN(num)) return amount;
  return `${num.toLocaleString("ru-RU", {
    maximumFractionDigits: 2,
  })}${currency ? " " + currency : ""}`;
}

export default function HolderDashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const d = await v1Fetch<Dashboard>("/holder/dashboard");
        if (!cancelled) setData(d);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Ошибка");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold">Главная</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Краткий статус по вашим тайтлам, сделкам и выплатам.
        </p>
      </div>

      {error ? (
        <div className="mb-6 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card
          icon={<Film className="size-5 text-primary" />}
          label="Тайтлы в каталоге"
          value={data?.titlesCount ?? "—"}
          href="/holder/titles"
        />
        <Card
          icon={<Handshake className="size-5 text-primary" />}
          label="Активные сделки"
          value={data?.activeDealsCount ?? "—"}
          href="/holder/deals"
        />
        <Card
          icon={<FileText className="size-5 text-primary" />}
          label="Договоры в работе"
          value={data?.pendingContractsCount ?? "—"}
          href="/holder/contracts"
        />
        <Card
          icon={<Wallet className="size-5 text-primary" />}
          label={data?.financeVisibility === "limited" ? "Выплат всего" : "Выплаты, сумма"}
          value={
            data
              ? data.financeVisibility === "limited"
                ? data.payoutsCount
                : fmtMoney(data.payoutsTotal ?? "0")
              : "—"
          }
          href="/holder/payouts"
        />
      </div>

      {data?.financeVisibility === "limited" ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Конкретные суммы скрыты. Чтобы открыть полный доступ к финансам —
          свяжитесь с вашим менеджером.
        </p>
      ) : null}

      {data?.lastPayout ? (
        <div className="mt-6 rounded-xl border border-border/40 bg-card p-5">
          <h2 className="mb-1 text-sm font-medium text-muted-foreground">
            Последняя выплата
          </h2>
          {data.financeVisibility === "full" && data.lastPayout.amount ? (
            <p className="text-lg font-semibold">
              {fmtMoney(data.lastPayout.amount, data.lastPayout.currency)}
            </p>
          ) : (
            <p className="text-lg font-semibold">
              сумма скрыта · {data.lastPayout.currency}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            {new Date(data.lastPayout.at).toLocaleDateString("ru-RU")}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function Card({
  icon,
  label,
  value,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group relative flex flex-col gap-3 rounded-xl border border-border/40 bg-card p-5 transition-colors hover:border-primary/40"
    >
      <div className="flex items-center justify-between">
        <span className="rounded-md bg-primary/10 p-2">{icon}</span>
        <ArrowUpRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </div>
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="mt-1 text-2xl font-semibold">{value}</p>
      </div>
    </Link>
  );
}
