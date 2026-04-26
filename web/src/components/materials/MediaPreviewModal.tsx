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
                v1DownloadFile(downloadPath, file.originalName).catch(() =>
                  undefined,
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
  const mime = file.mimeType.toLowerCase();
  const ext = file.originalName.split(".").pop()?.toLowerCase() ?? "";

  if (mime.startsWith("image/")) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={file.originalName}
        className="max-h-full max-w-full object-contain"
      />
    );
  }

  if (mime.startsWith("video/")) {
    return (
      <video
        src={src}
        controls
        playsInline
        className="max-h-full max-w-full bg-black"
      />
    );
  }

  if (mime.startsWith("audio/")) {
    return (
      <div className="flex flex-col items-center gap-3 p-6">
        <audio src={src} controls className="w-full max-w-xl" />
      </div>
    );
  }

  if (mime === "application/pdf" || ext === "pdf") {
    return (
      <iframe
        src={src}
        title={file.originalName}
        className="h-full w-full border-0 bg-white"
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
