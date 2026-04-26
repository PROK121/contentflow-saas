import { NextRequest, NextResponse } from "next/server";

function apiOrigin(): string {
  return (process.env.API_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

/// Прокси для приёма инвайта. Нест возвращает accessToken в JSON,
/// мы прячем его в httpOnly cookie cf_session — точно так же как при
/// обычном логине (/api/auth/login).
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Некорректное тело запроса" }, { status: 400 });
  }

  let r: Response;
  try {
    r = await fetch(`${apiOrigin()}/v1/auth/holder/invites/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    return NextResponse.json(
      {
        message: `Сервер API недоступен. ${e instanceof Error ? e.message : ""}`,
      },
      { status: 503 },
    );
  }

  const text = await r.text();
  if (!r.ok) {
    return new NextResponse(text, {
      status: r.status,
      headers: { "Content-Type": r.headers.get("content-type") ?? "application/json" },
    });
  }

  let data: { accessToken?: string; user?: unknown };
  try {
    data = JSON.parse(text);
  } catch {
    return NextResponse.json(
      { message: "API вернул не JSON" },
      { status: 502 },
    );
  }

  if (!data.accessToken || typeof data.accessToken !== "string") {
    return NextResponse.json(
      { message: "В ответе API нет accessToken" },
      { status: 502 },
    );
  }

  const res = NextResponse.json({ user: data.user });
  res.cookies.set("cf_session", data.accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
