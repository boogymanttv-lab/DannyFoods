import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const ADMIN_COOKIE = "dd_admin_session";
const COURIER_COOKIE = "dd_courier_session";
const CUSTOMER_COOKIE = "dd_customer_session";
const SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET || "danidunner-dev-secret-change-me-in-prod"
);

// Customer account endpoints that must stay reachable without an existing
// session — the login/register forms themselves, the Google OAuth
// redirect+callback, and a lightweight "am I logged in?" check used by the
// checkout page (which works fine for guests too).
const PUBLIC_ACCOUNT_PATHS = [
  "/account/login",
  "/account/register",
  "/api/account/login",
  "/api/account/register",
  "/api/account/logout",
  "/api/account/session",
  "/api/account/google/start",
  "/api/account/google/callback",
];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/admin/login") || pathname.startsWith("/api/admin/login")) {
    return NextResponse.next();
  }
  if (pathname.startsWith("/courier/login") || pathname.startsWith("/api/courier/login")) {
    return NextResponse.next();
  }
  if (PUBLIC_ACCOUNT_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    return guard(req, ADMIN_COOKIE, "/admin/login");
  }

  if (pathname.startsWith("/courier") || pathname.startsWith("/api/courier")) {
    return guard(req, COURIER_COOKIE, "/courier/login");
  }

  if (pathname.startsWith("/account") || pathname.startsWith("/api/account")) {
    return guard(req, CUSTOMER_COOKIE, "/account/login");
  }

  return NextResponse.next();
}

async function guard(req: NextRequest, cookieName: string, loginPath: string) {
  const token = req.cookies.get(cookieName)?.value;
  if (!token) return redirectToLogin(req, loginPath);
  try {
    await jwtVerify(token, SECRET);
    return NextResponse.next();
  } catch {
    return redirectToLogin(req, loginPath);
  }
}

function redirectToLogin(req: NextRequest, loginPath: string) {
  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Неоторизиран достъп" }, { status: 401 });
  }
  const loginUrl = new URL(loginPath, req.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/admin/:path*",
    "/courier/:path*",
    "/api/courier/:path*",
    "/account/:path*",
    "/api/account/:path*",
  ],
};
