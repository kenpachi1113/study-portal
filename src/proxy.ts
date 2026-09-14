import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session-token";

/**
 * Грубая отсечка: залогинен или нет, и та ли роль для раздела.
 *
 * Middleware НЕ решает, доступна ли конкретная тема: для этого нужен запрос
 * в базу, а он здесь недопустим. Права на объект проверяются в lib/access.ts
 * при каждом обращении.
 */

const PUBLIC_PATHS = ["/login", "/api/auth/login"];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const session = await verifySessionToken(
    req.cookies.get(SESSION_COOKIE)?.value,
  );

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    if (session && !session.mustSetPassword) {
      return NextResponse.redirect(
        new URL(session.role === "STUDENT" ? "/study" : "/admin", req.url),
      );
    }
    return NextResponse.next();
  }

  if (!session) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // пока пароль не задан — никуда, кроме страницы смены пароля
  if (session.mustSetPassword && pathname !== "/set-password") {
    return NextResponse.redirect(new URL("/set-password", req.url));
  }

  if (pathname.startsWith("/admin") && session.role === "STUDENT") {
    return NextResponse.redirect(new URL("/study", req.url));
  }

  if (pathname.startsWith("/study") && session.role !== "STUDENT") {
    return NextResponse.redirect(new URL("/admin", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/study/:path*",
    "/me/:path*",
    "/api/materials/:path*",
    "/set-password",
    "/login",
  ],
};
