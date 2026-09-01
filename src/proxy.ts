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
    return guardAdmin(req);
  }

  if (pathname.startsWith("/courier") || pathname.startsWith("/api/courier")) {
    return guard(req, COURIER_COOKIE, "/courier/login");
  }

  if (pathname.startsWith("/account") || pathname.startsWith("/api/account")) {
    return guard(req, CUSTOMER_COOKIE, "/account/login");
  }

  return NextResponse.next();
}

// Employee ("staff") admin accounts are restricted to the Поръчки page and
// the handful of API endpoints that page needs — everything else in
// /admin and /api/admin is reserved for the owner (see
// src/components/admin/ProductsManager.tsx's sibling pages, Настройки →
// Служители). A token with no role at all (signed before this feature
// existed) is treated as a full-access owner, same as before.
const STAFF_ALLOWED_API_PREFIXES = ["/api/admin/orders"];
const STAFF_ALLOWED_API_GET_ONLY = ["/api/admin/couriers", "/api/admin/settings"];

function staffApiAllowed(pathname: string, method: string): boolean {
  if (pathname === "/api/admin/logout") return true;
  if (STAFF_ALLOWED_API_PREFIXES.some((p) => pathname.startsWith(p))) return true;
  if (method === "GET" && STAFF_ALLOWED_API_GET_ONLY.some((p) => pathname.startsWith(p))) {
    return true;
  }
  return false;
}

async function guardAdmin(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith("/api/");
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  if (!token) return redirectToLogin(req, "/admin/login");

  let payload: Record<string, unknown> | null = null;
  try {
    payload = (await jwtVerify(token, SECRET)).payload;
  } catch {
    return redirectToLogin(req, "/admin/login");
  }

  if (payload.role !== "staff") return NextResponse.next();

  // Staff account — confined to Поръчки.
  if (isApi) {
    if (staffApiAllowed(pathname, req.method)) return NextResponse.next();
    return NextResponse.json({ error: "Неоторизиран достъп" }, { status: 403 });
  }
  if (pathname.startsWith("/admin/orders")) return NextResponse.next();
  return NextResponse.redirect(new URL("/admin/orders", req.url));
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
