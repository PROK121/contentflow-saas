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

/**
 * HTTP-коды, при которых имеет смысл попробовать запрос ещё раз: Render 502/503/504
 * обычно означают «API перезапускается», и следующий запрос через секунду уже проходит.
 */
const TRANSIENT_STATUSES = new Set([502, 503, 504]);

/**
 * Короткое понятное сообщение для транзиентных падений. Полный HTML 502-страницы
 * Render в консоль мы не льём — он не даёт никакой диагностической информации.
 */
function friendlyErrorMessage(status: number, bodyText: string): string {
  const trimmed = bodyText.trim();
  if (TRANSIENT_STATUSES.has(status) || trimmed.startsWith("<")) {
    return `API временно недоступен (HTTP ${status}). Повторите действие через несколько секунд.`;
  }
  try {
    const j = JSON.parse(trimmed) as { message?: unknown };
    if (j.message !== undefined) {
      return typeof j.message === "string" ? j.message : JSON.stringify(j.message);
    }
  } catch {
    /* raw */
  }
  return trimmed || `HTTP ${status}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Безопасно ли повторить запрос. Идемпотентные методы (GET/HEAD) — да; остальные —
 * только если пользователь явно разрешил (для POST, ведущих к мутациям, нельзя).
 */
function isRetriableMethod(method: string | undefined): boolean {
  const m = (method ?? "GET").toUpperCase();
  return m === "GET" || m === "HEAD";
}

/**
 * Внутренний fetch с ретраями на транзиентные HTTP 502/503/504 и сетевые ошибки.
 * Возвращает «сырой» Response вне зависимости от статуса — решение принимает вызывающий код.
 */
async function fetchWithRetry(
  url: string,
  init: RequestInit,
  maxAttempts = 3,
): Promise<Response> {
  const retriable = isRetriableMethod(init.method);
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url, init);
      if (!res.ok && retriable && TRANSIENT_STATUSES.has(res.status) && attempt < maxAttempts) {
        await sleep(400 * attempt);
        continue;
      }
      return res;
    } catch (e) {
      lastError = e;
      if (!retriable || attempt >= maxAttempts) break;
      await sleep(400 * attempt);
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Сеть недоступна. Проверьте соединение и попробуйте ещё раз.");
}

async function v1GetBinaryResponse(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const url = `/v1${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetchWithRetry(url, {
    method: "GET",
    cache: "no-store",
    credentials: "include",
    ...init,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(friendlyErrorMessage(res.status, text));
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
    throw new Error(friendlyErrorMessage(res.status, text));
  }
  if (!text.trim()) return undefined as T;
  return JSON.parse(text) as T;
}

export async function v1Fetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const url = `/v1${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetchWithRetry(url, {
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
    throw new Error(friendlyErrorMessage(res.status, text));
  }
  if (!text.trim()) return undefined as T;
  return JSON.parse(text) as T;
}
