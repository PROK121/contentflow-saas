"use client";

import { useEffect, useState } from "react";
import { Eye, Wallet } from "lucide-react";
import { v1Fetch } from "@/lib/v1-client";
import { EmptyState, ErrorState, LoadingState } from "@/components/PageState";
import { tr } from "@/lib/i18n";

interface PayoutLimited {
  id: string;
  currency: string;
  createdAt: string;
  updatedAt: string;
  contract: {
    id: string;
    number: string;
    deal: { id: string; title: string } | null;
  };
}

interface PayoutFull extends PayoutLimited {
  amountGross: string;
  amountNet: string;
  withholdingTaxAmount: string;
}

type PayoutResponse =
  | { items: PayoutFull[]; financeVisibility: "full" }
  | { items: PayoutLimited[]; financeVisibility: "limited" };

function fmt(amount: string, currency: string): string {
  const num = Number(amount);
  if (Number.isNaN(num)) return `${amount} ${currency}`;
  return `${num.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} ${currency}`;
}

export default function HolderPayoutsPage() {
  const [data, setData] = useState<PayoutResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    try {
      setError(null);
      setData(await v1Fetch<PayoutResponse>("/holder/payouts"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  const isLimited = data?.financeVisibility === "limited";

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">{tr("holder", "payoutsTitle")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          История начислений по контрактам, в которых вы — правообладатель.
        </p>
      </div>

      {error ? <ErrorState message={error} onRetry={() => void reload()} /> : null}

      {isLimited ? (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <Eye className="mt-0.5 size-4 shrink-0" />
          <div>
            <strong>Ограниченный режим финансов.</strong> Конкретные суммы
            видны только в кабинете менеджера. Чтобы открыть полный доступ —
            свяжитесь с вашим менеджером.
          </div>
        </div>
      ) : null}

      {data === null ? (
        <LoadingState label={tr("holder", "loadingData")} />
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={<Wallet className="size-10" />}
          title={tr("holder", "noPayouts")}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/40 bg-card">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Дата</th>
                <th className="px-4 py-3 text-left">Договор</th>
                <th className="px-4 py-3 text-left">Сделка</th>
                <th className="px-4 py-3 text-left">Валюта</th>
                {!isLimited ? (
                  <>
                    <th className="px-4 py-3 text-right">Начислено</th>
                    <th className="px-4 py-3 text-right">Удержание</th>
                    <th className="px-4 py-3 text-right">К выплате</th>
                  </>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {data.items.map((p) => (
                <tr key={p.id} className="border-t border-border/40">
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(p.createdAt).toLocaleDateString("ru-RU")}
                  </td>
                  <td className="px-4 py-3">{p.contract.number}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {p.contract.deal?.title ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {p.currency}
                  </td>
                  {!isLimited ? (
                    <>
                      <td className="px-4 py-3 text-right">
                        {fmt(
                          (p as PayoutFull).amountGross,
                          p.currency,
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">
                        {fmt(
                          (p as PayoutFull).withholdingTaxAmount,
                          p.currency,
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {fmt(
                          (p as PayoutFull).amountNet,
                          p.currency,
                        )}
                      </td>
                    </>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}
