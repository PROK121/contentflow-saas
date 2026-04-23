import { NextRequest, NextResponse } from "next/server";

function apiOrigin(): string {
  return (process.env.API_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Некорректное тело запроса" }, { status: 400 });
  }

  let r: Response;
  try {
    r = await fetch(`${apiOrigin()}/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    const hint =
      e instanceof Error && e.message.includes("fetch")
        ? ` Проверьте, что Nest API запущен (${apiOrigin()}).`
        : "";
    return NextResponse.json(
      {
        message: `Сервер API недоступен.${hint}`,
      },
      { status: 503 },
    );
  }

  const text = await r.text();
  if (!r.ok) {
    return new NextResponse(text, {
      status: r.status,
      headers: {
        "Content-Type": r.headers.get("content-type") ?? "application/json",
      },
    });
  }

  let data: { accessToken?: string; user?: unknown };
  try {
    data = JSON.parse(text) as { accessToken?: string; user?: unknown };
  } catch {
    return NextResponse.json(
      { message: "API вернул не JSON при успешном входе" },
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
