import { jwtVerify } from "jose";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

function jwtSecretKey() {
  return new TextEncoder().encode(
    process.env.JWT_SECRET ?? "dev-change-me",
  );
}

function redirectToLogin(request: NextRequest, pathname: string) {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  if (pathname !== "/" && !pathname.startsWith("/login")) {
    url.searchParams.set("from", pathname);
  }
  return NextResponse.redirect(url);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/login") || pathname.startsWith("/api/auth/")) {
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
    return redirectToLogin(request, pathname);
  }

  try {
    await jwtVerify(token, jwtSecretKey());
    return NextResponse.next();
  } catch {
    return redirectToLogin(request, pathname);
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
