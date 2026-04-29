"use client";

import { useEffect, useState } from "react";
import { ArrowDownToLine, FileText, X } from "lucide-react";
import { v1ApiPath, v1DownloadFile } from "@/lib/v1-client";

/// Универсальный предпросмотр загруженного материала. Используется и в
/// CRM-карточке тайтла (CatalogItemMaterialRequests), и в кабинете
/// правообладателя (/holder/materials/:id).
///
/// Стратегия:
/// - Картинки и видео грузим напрямую через `<img src>` / `<video src>` —
///   стриминг, минимум памяти, корректные progressive responses.
/// - PDF — `<iframe>`, тоже прямой URL: браузер сам ставит свой viewer.
/// - DOCX/XLSX/PPT и прочее — собственного viewer'а в браузере нет, поэтому
///   показываем заглушку «формат не поддерживает онлайн-просмотр» и кнопку
///   «Скачать». Для текстовых форматов (txt/json) — fetch + текстовый блок.
///
/// Авторизация — через session-cookie, прямые URL работают как обычные
/// запросы в текущем origin (`/v1/.../download?inline=1`). Отдельный
/// blob/object-url не нужен (он бы сначала тянул весь файл в память).

export type MediaPreviewBasePath =
  /// CRM: `/material-requests/:id/uploads/:uploadId`
  | { kind: "crm"; requestId: string; uploadId: string }
  /// Holder: `/holder/material-requests/:id/uploads/:uploadId`
  | { kind: "holder"; requestId: string; uploadId: string };

export interface MediaPreviewFile {
  originalName: string;
  mimeType: string;
  size: number;
}

interface Props {
  base: MediaPreviewBasePath;
  file: MediaPreviewFile;
  onClose: () => void;
}

export function MediaPreviewModal({ base, file, onClose }: Props) {
  // Закрытие по Esc — типичный UX для модальных просмотров.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const inlineUrl = v1ApiPath(`${pathFor(base)}/download?inline=1`);
  const downloadPath = `${pathFor(base)}/download`;
  const [downloadError, setDownloadError] = useState<string | null>(null);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="flex h-full max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-3 border-b border-border/40 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{file.originalName}</p>
            <p className="text-xs text-muted-foreground">
              {file.mimeType} · {formatBytes(file.size)}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() =>
                v1DownloadFile(downloadPath, file.originalName).catch((e) =>
                  setDownloadError(
                    e instanceof Error ? e.message : "Не удалось скачать файл",
                  ),
                )
              }
              className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background px-3 py-1.5 text-xs hover:bg-muted"
            >
              <ArrowDownToLine className="size-3.5" />
              Скачать
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Закрыть"
            >
              <X className="size-4" />
            </button>
          </div>
        </header>
        {downloadError ? (
          <div className="border-b border-border/40 bg-destructive/10 px-4 py-2 text-xs text-destructive">
            {downloadError}
          </div>
        ) : null}
        <div className="flex flex-1 items-center justify-center overflow-auto bg-muted/30">
          <PreviewBody file={file} src={inlineUrl} />
        </div>
      </div>
    </div>
  );
}

function PreviewBody({
  file,
  src,
}: {
  file: MediaPreviewFile;
  src: string;
}) {
  const [retrySeed, setRetrySeed] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoStartedAt, setVideoStartedAt] = useState<number | null>(null);
  const mime = file.mimeType.toLowerCase();
  const ext = file.originalName.split(".").pop()?.toLowerCase() ?? "";
  const srcWithRetry = `${src}${src.includes("?") ? "&" : "?"}r=${retrySeed}`;
  const estimatedSeconds = estimatePreviewSeconds(file.size);

  if (loadError) {
    return (
      <div className="flex flex-col items-center gap-3 p-8 text-center">
        <p className="text-sm font-medium text-destructive">
          Не удалось загрузить предпросмотр
        </p>
        <p className="max-w-lg text-xs text-muted-foreground">{loadError}</p>
        <button
          type="button"
          className="rounded-md border border-border/60 bg-background px-3 py-1.5 text-xs hover:bg-muted"
          onClick={() => {
            setLoadError(null);
            setRetrySeed((s) => s + 1);
          }}
        >
          Повторить
        </button>
      </div>
    );
  }

  if (mime.startsWith("image/")) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={srcWithRetry}
        alt={file.originalName}
        className="max-h-full max-w-full object-contain"
        onError={() =>
          setLoadError("Сервер временно недоступен или файл не удалось прочитать.")
        }
      />
    );
  }

  if (mime.startsWith("video/")) {
    return (
      <div className="relative flex h-full w-full items-center justify-center">
        {videoLoading ? (
          <div className="absolute left-3 top-3 z-10 rounded-md bg-black/70 px-2 py-1 text-xs text-white">
            Загрузка видео…
            {estimatedSeconds ? ` ~${formatDurationShort(estimatedSeconds)}` : ""}
            {videoStartedAt
              ? ` · прошло ${formatDurationShort(
                  Math.max(1, Math.round((Date.now() - videoStartedAt) / 1000)),
                )}`
              : ""}
          </div>
        ) : null}
        <video
          src={srcWithRetry}
          controls
          playsInline
          className="max-h-full max-w-full bg-black"
          onLoadStart={() => {
            setVideoLoading(true);
            setVideoStartedAt(Date.now());
          }}
          onCanPlay={() => setVideoLoading(false)}
          onError={() => {
            setVideoLoading(false);
            setLoadError(
              "Видео не удалось открыть. Частая причина — временная ошибка 502 на прокси. Нажмите «Повторить».",
            );
          }}
        />
      </div>
    );
  }

  if (mime.startsWith("audio/")) {
    return (
      <div className="flex flex-col items-center gap-3 p-6">
        <audio
          src={srcWithRetry}
          controls
          className="w-full max-w-xl"
          onError={() =>
            setLoadError("Аудио не удалось открыть. Попробуйте повторить.")
          }
        />
      </div>
    );
  }

  if (mime === "application/pdf" || ext === "pdf") {
    return (
      <iframe
        src={srcWithRetry}
        title={file.originalName}
        className="h-full w-full border-0 bg-white"
        onError={() =>
          setLoadError("PDF не удалось загрузить. Попробуйте повторить.")
        }
      />
    );
  }

  if (mime.startsWith("text/") || mime === "application/json") {
    return <TextPreview src={src} />;
  }

  // Office-форматы и всё прочее — браузер не умеет это рендерить inline.
  // Не пытаемся подключать сторонние viewers (Google Docs Viewer требует
  // публичный URL — у нас auth по cookie). Просто предлагаем скачать.
  return (
    <div className="flex flex-col items-center gap-3 p-12 text-center">
      <FileText className="size-12 text-muted-foreground" />
      <p className="text-sm font-medium">Онлайн-просмотр недоступен</p>
      <p className="max-w-md text-xs text-muted-foreground">
        Этот формат ({mime || ext}) не поддерживается в браузере для
        просмотра. Скачайте файл — он откроется в подходящем приложении
        на вашем устройстве.
      </p>
    </div>
  );
}

function estimatePreviewSeconds(sizeBytes: number): number | null {
  const nav = navigator as Navigator & {
    connection?: { downlink?: number };
  };
  const mbps = nav.connection?.downlink;
  if (!mbps || !Number.isFinite(mbps) || mbps <= 0) return null;
  const bytesPerSec = (mbps * 1024 * 1024) / 8;
  if (!Number.isFinite(bytesPerSec) || bytesPerSec <= 0) return null;
  return Math.max(1, Math.round(sizeBytes / bytesPerSec));
}

function formatDurationShort(sec: number): string {
  if (sec < 60) return `${sec}с`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s === 0 ? `${m}м` : `${m}м ${s}с`;
}

function TextPreview({ src }: { src: string }) {
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(src, { credentials: "include" })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then((t) => {
        if (!cancelled) setText(t);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Ошибка загрузки");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [src]);

  if (error) {
    return <div className="p-6 text-sm text-destructive">{error}</div>;
  }
  if (text === null) {
    return <div className="p-6 text-sm text-muted-foreground">Загрузка…</div>;
  }
  return (
    <pre className="h-full w-full overflow-auto whitespace-pre-wrap break-words bg-background p-4 text-xs">
      {text}
    </pre>
  );
}

function pathFor(base: MediaPreviewBasePath): string {
  switch (base.kind) {
    case "crm":
      return `/material-requests/${base.requestId}/uploads/${base.uploadId}`;
    case "holder":
      return `/holder/material-requests/${base.requestId}/uploads/${base.uploadId}`;
  }
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} Б`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} КБ`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} МБ`;
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} ГБ`;
}

/// Эвристика «можно ли просматривать в браузере». Используем в UI, чтобы
/// решать показывать ли кнопку «Просмотр» или сразу только «Скачать».
export function isPreviewable(mime: string, originalName: string): boolean {
  const m = (mime || "").toLowerCase();
  const ext = originalName.split(".").pop()?.toLowerCase() ?? "";
  if (
    m.startsWith("image/") ||
    m.startsWith("video/") ||
    m.startsWith("audio/") ||
    m.startsWith("text/") ||
    m === "application/json" ||
    m === "application/pdf"
  ) {
    return true;
  }
  // Иногда сервер кладёт application/octet-stream — судим по расширению.
  if (
    [
      "jpg",
      "jpeg",
      "png",
      "gif",
      "webp",
      "heic",
      "heif",
      "avif",
      "mp4",
      "webm",
      "mov",
      "m4v",
      "mp3",
      "wav",
      "ogg",
      "txt",
      "json",
      "pdf",
    ].includes(ext)
  ) {
    return true;
  }
  return false;
}
