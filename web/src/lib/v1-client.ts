/** Клиентский fetch к Nest через rewrite Next `/v1/*`. */

/** Путь к API для ссылок (скачивание DOCX и т.п., не JSON). */
export function v1ApiPath(path: string): string {
  return `/v1${path.startsWith("/") ? path : `/${path}`}`;
}

function parseFilenameFromContentDisposition(header: string | null): string | null {
  if (!header) return null;
  const star = /filename\*=UTF-8''([^;\n]+)/i.exec(header);
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1].trim());
    } catch {
      return star[1].trim();
    }
  }
  const quoted = /filename="([^"]+)"/i.exec(header);
  if (quoted?.[1]) return quoted[1];
  const plain = /filename=([^;\n]+)/i.exec(header);
  if (plain?.[1]) return plain[1].trim().replace(/^"|"$/g, "");
  return null;
}

async function v1GetBinaryResponse(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const url = `/v1${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    method: "GET",
    cache: "no-store",
    credentials: "include",
    ...init,
  });
  if (!res.ok) {
    const text = await res.text();
    let detail = text;
    try {
      const j = JSON.parse(text) as { message?: unknown };
      if (j.message !== undefined) {
        detail =
          typeof j.message === "string"
            ? j.message
            : JSON.stringify(j.message);
      }
    } catch {
      /* raw */
    }
    throw new Error(detail || `HTTP ${res.status}`);
  }
  return res;
}

/** PDF и другие бинарные ответы без сохранения на диск (превью в iframe и т.п.). */
export async function v1GetBlob(path: string, init?: RequestInit): Promise<Blob> {
  const res = await v1GetBinaryResponse(path, init);
  return res.blob();
}

/**
 * Скачивание бинарного ответа API (DOCX и т.д.) через Blob.
 * Не задаёт Content-Type: application/json — в отличие от v1Fetch.
 */
export async function v1DownloadFile(
  path: string,
  fallbackFileName: string,
): Promise<void> {
  const res = await v1GetBinaryResponse(path);
  const blob = await res.blob();
  const fromHeader =
    parseFilenameFromContentDisposition(res.headers.get("Content-Disposition")) ??
    fallbackFileName;
  const safeName = fromHeader.replace(/[/\\?%*:|"<>]/g, "_").slice(0, 200);
  const objectUrl = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = safeName || fallbackFileName;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/** POST `multipart/form-data` (без JSON Content-Type). */
export async function v1FormUpload<T>(path: string, formData: FormData): Promise<T> {
  const url = `/v1${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    method: "POST",
    credentials: "include",
    body: formData,
  });
  const text = await res.text();
  if (!res.ok) {
    let detail = text;
    try {
      const j = JSON.parse(text) as { message?: unknown };
      if (j.message !== undefined) {
        detail =
          typeof j.message === "string"
            ? j.message
            : JSON.stringify(j.message);
      }
    } catch {
      /* raw */
    }
    throw new Error(detail || `HTTP ${res.status}`);
  }
  if (!text.trim()) return undefined as T;
  return JSON.parse(text) as T;
}

export async function v1Fetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const url = `/v1${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    cache: "no-store",
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const text = await res.text();
  if (!res.ok) {
    let detail = text;
    try {
      const j = JSON.parse(text) as { message?: unknown };
      if (j.message !== undefined) {
        detail =
          typeof j.message === "string"
            ? j.message
            : JSON.stringify(j.message);
      }
    } catch {
      /* raw */
    }
    throw new Error(detail || `HTTP ${res.status}`);
  }
  if (!text.trim()) return undefined as T;
  return JSON.parse(text) as T;
}
