"use client";

import {
  ArrowDownToLine,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Eye,
  Loader2,
  Plus,
  Trash2,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { v1Fetch, v1DownloadFile } from "@/lib/v1-client";
import {
  isPreviewable,
  MediaPreviewModal,
} from "@/components/materials/MediaPreviewModal";
import {
  formatBytes,
  MaterialRequest,
  MaterialSlotDef,
  MaterialUpload,
  REVIEW_LABEL,
  REVIEW_TONE,
  STATUS_LABEL,
  STATUS_TONE,
} from "@/lib/material-requests";

interface Props {
  catalogItemId: string;
  /// Опциональный orgId правообладателя — берётся из catalogItem.rightsHolderOrgId
  /// чтобы корректно показывать предупреждение, если он не назначен.
  rightsHolderOrgId: string | null;
}

const SLOT_GROUP_LABELS: Record<MaterialSlotDef["group"], string> = {
  video: "Видео",
  image: "Графика",
  localization: "Локализация",
  document: "Документы",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ru-RU");
}

export function CatalogItemMaterialRequests({
  catalogItemId,
  rightsHolderOrgId,
}: Props) {
  const [items, setItems] = useState<MaterialRequest[] | null>(null);
  const [slots, setSlots] = useState<MaterialSlotDef[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  async function reload() {
    try {
      setError(null);
      const [list, slotCatalog] = await Promise.all([
        v1Fetch<MaterialRequest[]>(
          `/material-requests?catalogItemId=${encodeURIComponent(catalogItemId)}`,
        ),
        slots
          ? Promise.resolve(slots)
          : v1Fetch<MaterialSlotDef[]>("/material-slots"),
      ]);
      setItems(list);
      setSlots(slotCatalog);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogItemId]);

  function toggleOpen(id: string) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (!rightsHolderOrgId) {
    return (
      <section className="rounded-xl border border-border bg-card p-5 space-y-2">
        <h2 className="text-lg font-semibold">Материалы</h2>
        <p className="text-sm text-muted-foreground">
          Чтобы запросить материалы, сначала привяжите правообладателя
          к этому тайтлу (поле «Правообладатель»).
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Запросы материалов</h2>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted"
        >
          <Plus className="size-4" />
          Запросить материалы
        </button>
      </div>

      {error ? (
        <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {items === null ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Загрузка…
        </p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Запросов материалов пока нет. Создайте первый — правообладатель
          увидит его в своём кабинете.
        </p>
      ) : (
        <ul className="divide-y divide-border/40 rounded-lg border border-border/40">
          {items.map((req) => {
            const isOpen = openIds.has(req.id);
            return (
              <li key={req.id}>
                <button
                  type="button"
                  onClick={() => toggleOpen(req.id)}
                  className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left hover:bg-muted/40"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-md px-2 py-0.5 text-xs ${STATUS_TONE[req.status]}`}
                      >
                        {STATUS_LABEL[req.status]}
                      </span>
                      <span className="text-sm font-medium">
                        Слотов: {req.requestedSlots.length}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Создан {formatDate(req.createdAt)} · Срок:{" "}
                      {formatDate(req.dueAt)} · Загружено: {req.uploads.length}
                    </p>
                    {req.note ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        «{req.note}»
                      </p>
                    ) : null}
                  </div>
                  {isOpen ? (
                    <ChevronUp className="size-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                  )}
                </button>
                {isOpen ? (
                  <RequestDetail
                    request={req}
                    slots={slots ?? []}
                    onChange={() => void reload()}
                    onError={(msg) => setError(msg)}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {creating && slots ? (
        <CreateRequestModal
          catalogItemId={catalogItemId}
          slots={slots}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            void reload();
          }}
        />
      ) : null}
    </section>
  );
}

function RequestDetail({
  request,
  slots,
  onChange,
  onError,
}: {
  request: MaterialRequest;
  slots: MaterialSlotDef[];
  onChange: () => void;
  onError: (msg: string) => void;
}) {
  const slotByKey = useMemo(
    () => new Map(slots.map((s) => [s.key, s])),
    [slots],
  );

  async function cancelRequest() {
    if (!confirm("Удалить запрос материалов? Это действие нельзя отменить.")) {
      return;
    }
    try {
      await v1Fetch(`/material-requests/${request.id}`, { method: "DELETE" });
      onChange();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Ошибка удаления");
    }
  }

  return (
    <div className="space-y-3 border-t border-border/40 bg-muted/20 px-4 py-3">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => void cancelRequest()}
          className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-background px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="size-3.5" />
          Удалить запрос
        </button>
      </div>

      {request.requestedSlots.map((slot) => {
        const def = slotByKey.get(slot);
        const slotUploads = request.uploads.filter((u) => u.slot === slot);
        return (
          <div
            key={slot}
            className="rounded-lg border border-border/40 bg-card p-3"
          >
            <div className="mb-2 flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium">{def?.label ?? slot}</p>
                {def ? (
                  <p className="text-xs text-muted-foreground">
                    {def.description}
                  </p>
                ) : null}
              </div>
              <span className="text-xs text-muted-foreground">
                {slotUploads.length === 0
                  ? "—"
                  : `Файлов: ${slotUploads.length}`}
              </span>
            </div>
            {slotUploads.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Файлов не загружено.
              </p>
            ) : (
              <ul className="space-y-2">
                {slotUploads.map((u) => (
                  <UploadRow
                    key={u.id}
                    upload={u}
                    requestId={request.id}
                    onChange={onChange}
                    onError={onError}
                  />
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

function UploadRow({
  upload,
  requestId,
  onChange,
  onError,
}: {
  upload: MaterialUpload;
  requestId: string;
  onChange: () => void;
  onError: (msg: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [comment, setComment] = useState(upload.reviewerComment ?? "");
  const [showComment, setShowComment] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const canPreview = isPreviewable(
    upload.mimeType ?? "",
    upload.originalName,
  );

  async function review(status: "approved" | "rejected") {
    setBusy(true);
    try {
      await v1Fetch(
        `/material-requests/${requestId}/uploads/${upload.id}/review`,
        {
          method: "POST",
          body: JSON.stringify({
            reviewStatus: status,
            reviewerComment: comment.trim() || undefined,
          }),
        },
      );
      onChange();
      setShowComment(false);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="rounded-md border border-border/40 bg-background px-3 py-2 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium">{upload.originalName}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{formatBytes(upload.size)}</span>
            <span>·</span>
            <span>{new Date(upload.uploadedAt).toLocaleString("ru-RU")}</span>
            <span
              className={`rounded-md px-2 py-0.5 ${REVIEW_TONE[upload.reviewStatus]}`}
            >
              {REVIEW_LABEL[upload.reviewStatus]}
            </span>
          </div>
          {upload.reviewerComment ? (
            <p className="mt-1 text-xs text-muted-foreground">
              «{upload.reviewerComment}»
            </p>
          ) : null}
          {upload.reviewedBy ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Проверял:{" "}
              {upload.reviewedBy.displayName || upload.reviewedBy.email}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          {canPreview ? (
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="inline-flex items-center gap-1 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Просмотр"
            >
              <Eye className="size-4" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={() =>
              v1DownloadFile(
                `/material-requests/${requestId}/uploads/${upload.id}/download`,
                upload.originalName,
              ).catch((e) =>
                onError(e instanceof Error ? e.message : "Ошибка"),
              )
            }
            className="inline-flex items-center gap-1 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Скачать"
          >
            <ArrowDownToLine className="size-4" />
          </button>
        </div>
      </div>

      {previewOpen ? (
        <MediaPreviewModal
          base={{ kind: "crm", requestId, uploadId: upload.id }}
          file={{
            originalName: upload.originalName,
            mimeType: upload.mimeType ?? "application/octet-stream",
            size: Number(upload.size) || 0,
          }}
          onClose={() => setPreviewOpen(false)}
        />
      ) : null}

      {showComment ? (
        <textarea
          className="mt-2 w-full rounded-md border border-border/60 bg-background px-2 py-1.5 text-xs"
          rows={2}
          placeholder="Комментарий для правообладателя"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
      ) : null}

      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || upload.reviewStatus === "approved"}
          onClick={() => void review("approved")}
          className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
        >
          <CheckCircle2 className="size-3.5" />
          Принять
        </button>
        <button
          type="button"
          disabled={busy || upload.reviewStatus === "rejected"}
          onClick={() => {
            if (!showComment) setShowComment(true);
            else void review("rejected");
          }}
          className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700 hover:bg-red-100 disabled:opacity-50"
        >
          <XCircle className="size-3.5" />
          {showComment ? "Подтвердить отказ" : "Отклонить"}
        </button>
        {!showComment ? (
          <button
            type="button"
            onClick={() => setShowComment(true)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Оставить комментарий
          </button>
        ) : null}
      </div>
    </li>
  );
}

function CreateRequestModal({
  catalogItemId,
  slots,
  onClose,
  onCreated,
}: {
  catalogItemId: string;
  slots: MaterialSlotDef[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dueAt, setDueAt] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(slot: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slot)) next.delete(slot);
      else next.add(slot);
      return next;
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (selected.size === 0) {
      setError("Выберите хотя бы один тип материала");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await v1Fetch("/material-requests", {
        method: "POST",
        body: JSON.stringify({
          catalogItemId,
          requestedSlots: Array.from(selected),
          dueAt: dueAt || undefined,
          note: note.trim() || undefined,
        }),
      });
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  const grouped = useMemo(() => {
    const buckets: Record<string, MaterialSlotDef[]> = {};
    for (const s of slots) {
      buckets[s.group] ??= [];
      buckets[s.group].push(s);
    }
    return buckets;
  }, [slots]);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4 py-6">
      <form
        onSubmit={submit}
        className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl bg-card shadow-lg"
      >
        <div className="flex items-center justify-between border-b border-border/40 px-5 py-3">
          <h3 className="font-semibold">Запросить материалы</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {error ? (
            <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <div>
            <label className="text-sm font-medium">Что запрашиваем</label>
            <div className="mt-2 space-y-3">
              {(["video", "image", "localization", "document"] as const).map(
                (group) => {
                  const list = grouped[group];
                  if (!list || list.length === 0) return null;
                  return (
                    <div key={group}>
                      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {SLOT_GROUP_LABELS[group]}
                      </p>
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                        {list.map((s) => {
                          const checked = selected.has(s.key);
                          return (
                            <label
                              key={s.key}
                              className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
                                checked
                                  ? "border-primary/50 bg-primary/5"
                                  : "border-border/60 hover:bg-muted/30"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggle(s.key)}
                                className="mt-0.5"
                              />
                              <span>
                                <span className="block font-medium">
                                  {s.label}
                                </span>
                                <span className="block text-xs text-muted-foreground">
                                  {s.description}
                                </span>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                },
              )}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm">
              Срок (опционально)
              <input
                type="date"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
                className="mt-1 w-full rounded-md border border-border/60 bg-background px-2 py-1.5 text-sm"
              />
            </label>
            <label className="text-sm md:col-span-2">
              Комментарий правообладателю
              <textarea
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Например: «Постер вертикальный 2000×3000, мастер ProRes 422 HQ»"
                className="mt-1 w-full rounded-md border border-border/60 bg-background px-2 py-1.5 text-sm"
              />
            </label>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border/40 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            Создать запрос
          </button>
        </div>
      </form>
    </div>
  );
}
