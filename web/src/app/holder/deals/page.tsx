"use client";

import { useEffect, useState } from "react";
import { Handshake } from "lucide-react";
import { v1Fetch } from "@/lib/v1-client";
import { EmptyState, ErrorState, LoadingState } from "@/components/PageState";
import { tr } from "@/lib/i18n";

interface Deal {
  id: string;
  title: string;
  kind: "sale" | "purchase";
  stage: string;
  currency: string;
  expectedCloseAt: string | null;
  actualCloseAt: string | null;
  createdAt: string;
  updatedAt: string;
  buyer: { id: string; legalName: string; country: string };
  catalogItems: Array<{
    catalogItem: { id: string; title: string; slug: string; assetType: string };
  }>;
}

const STAGE_LABEL: Record<string, string> = {
  lead: "Запрос",
  negotiation: "Переговоры",
  contract: "Договор",
  paid: "Оплачено",
};

export default function HolderDealsPage() {
  const [deals, setDeals] = useState<Deal[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    try {
      setError(null);
      setDeals(await v1Fetch<Deal[]>("/holder/deals"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">{tr("holder", "dealsTitle")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Активные сделки и переговоры по вашему контенту. Финансовые детали
          скрыты — отображается только название покупателя и стадия.
        </p>
      </div>

      {error ? <ErrorState message={error} onRetry={() => void reload()} /> : null}

      {deals === null ? (
        <LoadingState label={tr("holder", "loadingData")} />
      ) : deals.length === 0 ? (
        <EmptyState
          icon={<Handshake className="size-10" />}
          title={tr("holder", "noDeals")}
        />
      ) : (
        <div className="space-y-3">
          {deals.map((d) => (
            <div
              key={d.id}
              className="rounded-xl border border-border/40 bg-card p-5"
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold">{d.title}</h3>
                <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  {STAGE_LABEL[d.stage] ?? d.stage}
                </span>
              </div>
              <div className="text-sm text-muted-foreground">
                <p>
                  Покупатель:{" "}
                  <span className="font-medium text-foreground">
                    {d.buyer.legalName}
                  </span>{" "}
                  ({d.buyer.country})
                </p>
                {d.expectedCloseAt ? (
                  <p>
                    Ожидаемое закрытие:{" "}
                    {new Date(d.expectedCloseAt).toLocaleDateString("ru-RU")}
                  </p>
                ) : null}
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {d.catalogItems.map((c) => (
                  <span
                    key={c.catalogItem.id}
                    className="rounded-md bg-muted px-2 py-0.5 text-xs"
                  >
                    {c.catalogItem.title}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
