"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  Loader2,
  QrCode,
  Trash2,
  Upload,
} from "lucide-react";
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
import { ContinueOnPhoneCard } from "../ContinueOnPhoneCard";

interface Props {
  params: Promise<{ id: string }>;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ru-RU");
}

export default function HolderMaterialDetailPage({ params }: Props) {
  const [requestId, setRequestId] = useState<string | null>(null);
  const [request, setRequest] = useState<MaterialRequest | null>(null);
  const [slots, setSlots] = useState<MaterialSlotDef[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);

  useEffect(() => {
    params.then((p) => setRequestId(p.id));
  }, [params]);

  const reload = async (id: string) => {
    try {
      setError(null);
      const [req, slotCatalog] = await Promise.all([
        v1Fetch<MaterialRequest>(`/holder/material-requests/${id}`),
        v1Fetch<MaterialSlotDef[]>("/holder/material-slots"),
      ]);
      setRequest(req);
      setSlots(slotCatalog);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    }
  };

  useEffect(() => {
    if (!requestId) return;
    void reload(requestId);
  }, [requestId]);

  if (!requestId) {
    return null;
  }

  if (error && !request) {
    return (
      <div className="mx-auto max-w-4xl">
        <Link
          href="/holder/materials"
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> К списку
        </Link>
        <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      </div>
    );
  }

  if (!request || !slots) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Загрузка…
      </p>
    );
  }

  const slotByKey = new Map(slots.map((s) => [s.key, s]));
  const isClosed =
    request.status === "complete" ||
    request.status === "rejected" ||
    request.status === "cancelled";

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/holder/materials"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> К списку
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Тайтл
          </p>
          <h1 className="text-2xl font-semibold">{request.catalogItem.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className={`rounded-md px-2 py-0.5 text-xs ${STATUS_TONE[request.status]}`}>
              {STATUS_LABEL[request.status]}
            </span>
            {request.dueAt ? (
              <span className="inline-flex items-center gap-1">
                <Calendar className="size-3.5" />
                Срок до {formatDate(request.dueAt)}
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" />
              Создан {formatDate(request.createdAt)}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowQr(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-border/40 bg-card px-3 py-2 text-sm hover:bg-muted"
        >
          <QrCode className="size-4" />
          Продолжить с телефона
        </button>
      </div>

      {request.note ? (
        <div className="mb-6 rounded-lg border border-border/40 bg-muted/30 p-4 text-sm">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Комментарий менеджера
          </p>
          <p className="whitespace-pre-wrap">{request.note}</p>
        </div>
      ) : null}

      {error ? (
        <div className="mb-4 flex items-start gap-2 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {isClosed ? (
        <div className="mb-6 rounded-lg bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          Запрос закрыт. Загрузка новых файлов недоступна.
        </div>
      ) : null}

      <div className="space-y-4">
        {request.requestedSlots.map((slotKey) => {
          const def = slotByKey.get(slotKey);
          const uploads = request.uploads.filter((u) => u.slot === slotKey);
          return (
            <SlotCard
              key={slotKey}
              slotKey={slotKey}
              def={def}
              uploads={uploads}
              requestId={request.id}
              disabled={isClosed}
              onChange={() => reload(request.id)}
              onError={(msg) => setError(msg)}
            />
          );
        })}
      </div>

      {showQr ? (
        <ContinueOnPhoneCard
          path={`/holder/materials/${request.id}`}
          onClose={() => setShowQr(false)}
        />
      ) : null}
    </div>
  );
}

function SlotCard({
  slotKey,
  def,
  uploads,
  requestId,
  disabled,
  onChange,
  onError,
}: {
  slotKey: string;
  def: MaterialSlotDef | undefined;
  uploads: MaterialUpload[];
  requestId: string;
  disabled: boolean;
  onChange: () => void;
  onError: (msg: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [drag, setDrag] = useState(false);
  const [previewUploadId, setPreviewUploadId] = useState<string | null>(null);

  const hasApproved = uploads.some((u) => u.reviewStatus === "approved");
  const previewUpload = previewUploadId
    ? uploads.find((u) => u.id === previewUploadId) ?? null
    : null;

  async function uploadFile(file: File) {
    if (busy) return;
    if (def && file.size > def.maxSizeBytes) {
      onError(
        `Файл «${file.name}» больше лимита для слота «${def.label}» (${formatBytes(
          def.maxSizeBytes,
        )})`,
      );
      return;
    }
    setBusy(true);
    setProgress(0);
    try {
      const fd = new FormData();
      fd.append("slot", slotKey);
      fd.append("file", file);
      // Используем XHR для прогресса. fetch + ReadableStream не даёт
      // прогресс-апи во всех браузерах, а нам нужен индикатор на 4-ГБ файлах.
      await xhrUpload(
        `/v1/holder/material-requests/${requestId}/uploads`,
        fd,
        (pct) => setProgress(pct),
      );
      onChange();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Не удалось загрузить файл");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  async function deleteUpload(uploadId: string) {
    if (!confirm("Удалить загруженный файл?")) return;
    try {
      await v1Fetch(`/holder/material-requests/${requestId}/uploads/${uploadId}`, {
        method: "DELETE",
      });
      onChange();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Ошибка удаления");
    }
  }

  return (
    <div className="rounded-xl border border-border/40 bg-card">
      <div className="border-b border-border/40 px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="flex items-center gap-2 font-medium">
              {hasApproved ? (
                <CheckCircle2 className="size-4 text-emerald-600" />
              ) : null}
              {def?.label ?? slotKey}
            </h3>
            {def?.description ? (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {def.description}
              </p>
            ) : null}
          </div>
          {def ? (
            <span className="text-xs text-muted-foreground">
              макс. {formatBytes(def.maxSizeBytes)}
            </span>
          ) : null}
        </div>
      </div>

      <div className="space-y-2 px-4 py-3">
        {uploads.length === 0 ? (
          <p className="text-xs text-muted-foreground">Файлов пока нет.</p>
        ) : (
          uploads.map((u) => (
            <div
              key={u.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border/30 bg-muted/20 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{u.originalName}</p>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>{formatBytes(u.size)}</span>
                  <span>·</span>
                  <span>{new Date(u.uploadedAt).toLocaleString("ru-RU")}</span>
                  <span
                    className={`rounded-md px-2 py-0.5 ${REVIEW_TONE[u.reviewStatus]}`}
                  >
                    {REVIEW_LABEL[u.reviewStatus]}
                  </span>
                </div>
                {u.reviewerComment ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Комментарий: {u.reviewerComment}
                  </p>
                ) : null}
              </div>
              <div className="flex items-center gap-1">
                {isPreviewable(u.mimeType ?? "", u.originalName) ? (
                  <button
                    type="button"
                    onClick={() => setPreviewUploadId(u.id)}
                    className="inline-flex items-center gap-1 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="Просмотр"
                    title="Просмотр"
                  >
                    <Eye className="size-4" />
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() =>
                    v1DownloadFile(
                      `/holder/material-requests/${requestId}/uploads/${u.id}/download`,
                      u.originalName,
                    ).catch((e) =>
                      onError(e instanceof Error ? e.message : "Ошибка"),
                    )
                  }
                  className="inline-flex items-center gap-1 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Скачать"
                  title="Скачать"
                >
                  <Download className="size-4" />
                </button>
                {u.reviewStatus === "pending" && !disabled ? (
                  <button
                    type="button"
                    onClick={() => deleteUpload(u.id)}
                    className="inline-flex items-center gap-1 rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Удалить"
                    title="Удалить"
                  >
                    <Trash2 className="size-4" />
                  </button>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>

      {!disabled ? (
        <div className="border-t border-border/40 px-4 py-3">
          <label
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-sm transition-colors ${
              drag
                ? "border-primary/60 bg-primary/5 text-primary"
                : "border-border/60 text-muted-foreground hover:bg-muted/30"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              const f = e.dataTransfer.files?.[0];
              if (f) void uploadFile(f);
            }}
          >
            <Upload className="size-5" />
            {busy ? (
              <>
                <span>Загрузка…{progress != null ? ` ${progress}%` : ""}</span>
                {progress != null ? (
                  <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                ) : null}
              </>
            ) : (
              <>
                <span>Перетащите файл или нажмите, чтобы выбрать</span>
                <span className="text-xs text-muted-foreground">
                  Можно загружать несколько версий — менеджер выберет лучшую
                </span>
              </>
            )}
            <input
              type="file"
              className="sr-only"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadFile(f);
                e.target.value = "";
              }}
            />
          </label>
        </div>
      ) : null}

      {previewUpload ? (
        <MediaPreviewModal
          base={{
            kind: "holder",
            requestId,
            uploadId: previewUpload.id,
          }}
          file={{
            originalName: previewUpload.originalName,
            mimeType:
              previewUpload.mimeType ?? "application/octet-stream",
            size: Number(previewUpload.size) || 0,
          }}
          onClose={() => setPreviewUploadId(null)}
        />
      ) : null}
    </div>
  );
}

/// XHR-загрузка с прогрессом. Используем XMLHttpRequest, потому что
/// fetch без `Request.duplex` не даёт upload-progress в браузере.
function xhrUpload(
  url: string,
  data: FormData,
  onProgress: (pct: number) => void,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.withCredentials = true;
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) {
        onProgress(Math.round((ev.loaded / ev.total) * 100));
      }
    };
    xhr.onload = () => {
      const text = xhr.responseText || "";
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(text ? JSON.parse(text) : null);
        } catch {
          resolve(null);
        }
      } else {
        let msg = `HTTP ${xhr.status}`;
        try {
          const parsed = JSON.parse(text);
          if (parsed && typeof parsed.message === "string") {
            msg = parsed.message;
          } else if (parsed && Array.isArray(parsed.message)) {
            msg = parsed.message.join("; ");
          }
        } catch {
          /* ignore */
        }
        reject(new Error(msg));
      }
    };
    xhr.onerror = () => reject(new Error("Сетевая ошибка"));
    xhr.send(data);
  });
}
