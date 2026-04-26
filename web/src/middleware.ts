import { jwtVerify } from "jose";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

function jwtSecretKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "JWT_SECRET is not set or is shorter than 16 chars. Set a strong secret in the environment (see web/.env.example).",
    );
  }
  return new TextEncoder().encode(secret);
}

function redirectTo(request: NextRequest, target: string, fromPath?: string) {
  const url = request.nextUrl.clone();
  url.pathname = target;
  url.search = "";
  if (fromPath && fromPath !== "/" && !fromPath.startsWith(target)) {
    url.searchParams.set("from", fromPath);
  }
  return NextResponse.redirect(url);
}

/// Публичные страницы кабинета правообладателя — доступны без auth-cookie.
/// Это форма принятия инвайта, форма запроса magic-link и страница верификации.
function isPublicHolderPath(pathname: string): boolean {
  return (
    pathname === "/holder/accept" ||
    pathname === "/holder/login" ||
    pathname === "/holder/auth/verify"
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth/") ||
    isPublicHolderPath(pathname)
  ) {
    return NextResponse.next();
  }

  if (
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname.startsWith("/brand/")
  ) {
    return NextResponse.next();
  }

  if (/\.(ico|png|jpg|jpeg|svg|gif|webp|woff2?)$/i.test(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get("cf_session")?.value;
  if (!token) {
    // Если адрес начинался с /holder — отправляем на /holder/login,
    // иначе на общий /login.
    if (pathname.startsWith("/holder")) {
      return redirectTo(request, "/holder/login", pathname);
    }
    return redirectTo(request, "/login", pathname);
  }

  let role: string | null = null;
  try {
    const verified = await jwtVerify(token, jwtSecretKey());
    role = typeof verified.payload.role === "string" ? verified.payload.role : null;
  } catch {
    if (pathname.startsWith("/holder")) {
      return redirectTo(request, "/holder/login", pathname);
    }
    return redirectTo(request, "/login", pathname);
  }

  // Жёсткое разделение: правообладатель видит только /holder/*; остальные — нигде там.
  // Это и UX, и безопасность (нельзя случайно попасть в админ-раздел через закладку).
  if (role === "rights_owner" && !pathname.startsWith("/holder")) {
    return redirectTo(request, "/holder");
  }
  if (role !== "rights_owner" && pathname.startsWith("/holder")) {
    return redirectTo(request, "/");
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
