"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronRight, FolderUp } from "lucide-react";
import { v1Fetch } from "@/lib/v1-client";
import { EmptyState, ErrorState, LoadingState } from "@/components/PageState";
import { tr } from "@/lib/i18n";
import {
  MaterialRequest,
  STATUS_LABEL,
  STATUS_TONE,
} from "@/lib/material-requests";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ru-RU");
}

function progressLabel(req: MaterialRequest): string {
  const requested = req.requestedSlots.length;
  const approved = new Set(
    req.uploads
      .filter((u) => u.reviewStatus === "approved")
      .map((u) => u.slot),
  ).size;
  return `${approved}/${requested}`;
}

export default function HolderMaterialsListPage() {
  const [requests, setRequests] = useState<MaterialRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"active" | "all">("active");

  async function reload(nextFilter = filter) {
    try {
      setError(null);
      const url =
        nextFilter === "active"
          ? "/holder/material-requests?activeOnly=1"
          : "/holder/material-requests";
      const data = await v1Fetch<MaterialRequest[]>(url);
      setRequests(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const url = filter === "active"
          ? "/holder/material-requests?activeOnly=1"
          : "/holder/material-requests";
        setError(null);
        const data = await v1Fetch<MaterialRequest[]>(url);
        if (!cancelled) setRequests(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Ошибка");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [filter]);

  const grouped = useMemo(() => {
    if (!requests) return null;
    const open = requests.filter(
      (r) => r.status === "pending" || r.status === "partial",
    );
    const closed = requests.filter(
      (r) => r.status !== "pending" && r.status !== "partial",
    );
    return { open, closed };
  }, [requests]);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{tr("holder", "materialsTitle")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Запросы материалов от менеджеров платформы. Загрузите файлы
            по чек-листу — менеджер проверит и подтвердит каждый.
          </p>
        </div>
        <div className="flex rounded-lg border border-border/40 bg-card p-1 text-sm">
          <button
            type="button"
            onClick={() => setFilter("active")}
            className={`rounded-md px-3 py-1.5 ${
              filter === "active"
                ? "bg-primary/10 font-medium text-primary"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            Активные
          </button>
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`rounded-md px-3 py-1.5 ${
              filter === "all"
                ? "bg-primary/10 font-medium text-primary"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            Все
          </button>
        </div>
      </div>

      {error ? <ErrorState message={error} onRetry={() => void reload()} /> : null}

      {requests === null ? (
        <LoadingState label={tr("holder", "loadingData")} />
      ) : requests.length === 0 ? (
        <EmptyState
          icon={<FolderUp className="size-10" />}
          title={tr("holder", "noMaterials")}
        />
      ) : (
        <div className="space-y-8">
          <RequestsSection
            title="Открытые"
            requests={grouped!.open}
            empty="Открытых запросов нет."
          />
          {filter === "all" ? (
            <RequestsSection
              title="Завершённые / отменённые"
              requests={grouped!.closed}
              empty="Завершённых запросов пока нет."
            />
          ) : null}
        </div>
      )}
    </div>
  );
}

function RequestsSection({
  title,
  requests,
  empty,
}: {
  title: string;
  requests: MaterialRequest[];
  empty: string;
}) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      {requests.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/40 bg-card">
          <ul className="divide-y divide-border/40">
            {requests.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/holder/materials/${r.id}`}
                  className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted/30"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium">
                        {r.catalogItem.title}
                      </p>
                      <span
                        className={`shrink-0 rounded-md px-2 py-0.5 text-xs ${STATUS_TONE[r.status]}`}
                      >
                        {STATUS_LABEL[r.status]}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Слотов: {progressLabel(r)} · Срок:{" "}
                      {formatDate(r.dueAt)} · Создан {formatDate(r.createdAt)}
                    </p>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
