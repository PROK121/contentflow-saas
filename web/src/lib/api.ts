import { cookies } from "next/headers";

function getServerApiBase(): string {
  return (process.env.API_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

async function serverAuthHeaders(): Promise<Record<string, string>> {
  try {
    const jar = await cookies();
    const token = jar.get("cf_session")?.value;
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
  } catch {
    return {};
  }
}

function parseApiErrorBody(text: string, status: number): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return `HTTP ${status}`;
  }
  if (
    trimmed.startsWith("<!DOCTYPE") ||
    trimmed.startsWith("<html") ||
    trimmed.includes("<!DOCTYPE html")
  ) {
    return `Вернулся HTML, а не JSON. Часто API_URL в web/.env.local указывает на Next (порт 3020), а не на Nest (порт 3000). Укажите API_URL=http://127.0.0.1:3000`;
  }
  try {
    const j = JSON.parse(trimmed) as {
      message?: string | string[];
      error?: string;
    };
    if (Array.isArray(j.message)) {
      return j.message.join("; ");
    }
    if (typeof j.message === "string") {
      return j.message;
    }
  } catch {
    // не JSON
  }
  if (trimmed.length > 500) {
    return `${trimmed.slice(0, 500)}…`;
  }
  return trimmed;
}

export type ApiFetchOptions = RequestInit & {
  label?: string;
};

/** Запросы с сервера Next (RSC, Server Actions). */
export async function apiFetch<T>(
  path: string,
  init?: ApiFetchOptions,
): Promise<T> {
  const { label, ...fetchInit } = init ?? {};
  const base = getServerApiBase();
  const url = `${base}/v1${path.startsWith("/") ? path : `/${path}`}`;

  const auth = await serverAuthHeaders();
  let res: Response;
  try {
    res = await fetch(url, {
      ...fetchInit,
      headers: {
        "Content-Type": "application/json",
        ...auth,
        ...fetchInit?.headers,
      },
      cache: "no-store",
    });
  } catch (e) {
    const hint =
      e instanceof Error && e.message.includes("fetch")
        ? ` Не удалось соединиться с ${base}. Запустите Nest в папке api (порт 3000). Не путайте с веб-портом 3020.`
        : "";
    throw new Error(
      `${label ? `[${label}] ` : ""}${e instanceof Error ? e.message : String(e)}.${hint}`,
    );
  }

  const text = await res.text();

  if (!res.ok) {
    const detail = parseApiErrorBody(text, res.status);
    const prefix =
      res.status === 500
        ? "API вернул 500. Проверьте Postgres, prisma migrate deploy, DATABASE_URL в api/.env. Детали: "
        : res.status >= 502
          ? "Прокси/сеть. "
          : "";
    throw new Error(`${label ? `[${label}] ` : ""}${prefix}${detail}`);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const trimmed = text.trim();
  if (
    trimmed.startsWith("<!DOCTYPE") ||
    trimmed.startsWith("<html") ||
    trimmed.includes("<!DOCTYPE html")
  ) {
    throw new Error(
      `${label ? `[${label}] ` : ""}Вернулся HTML вместо JSON. Укажите в web/.env.local API_URL=http://127.0.0.1:3000 (Nest), не порт Next (3020).`,
    );
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      `${label ? `[${label}] ` : ""}Ответ не JSON (первые символы): ${trimmed.slice(0, 120)}`,
    );
  }
}
