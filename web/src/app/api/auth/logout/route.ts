import { cookies } from "next/headers";
import { NextResponse } from "next/server";

function apiOrigin(): string {
  return (process.env.API_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

/// Logout: стираем cookie и **инкрементируем tokenVersion** на бэке через
/// `/v1/auth/logout-all`. Это инвалидирует ВСЕ ранее выпущенные JWT,
/// даже если кто-то получил cookie из другого браузера/устройства.
/// Best-effort: если API недоступен, всё равно стираем локальную cookie.
export async function POST() {
  try {
    const jar = await cookies();
    const token = jar.get("cf_session")?.value;
    if (token) {
      await fetch(`${apiOrigin()}/v1/auth/logout-all`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        // Не ждём долго — пользователь уже нажал «Выйти».
        signal: AbortSignal.timeout(3000),
      }).catch(() => undefined);
    }
  } catch {
    // ignore — главное стереть cookie
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set("cf_session", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return res;
}
