import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { getSettings } from "@/lib/repos/settings";

const ADMIN_COOKIE = "dd_admin_session";
const COURIER_COOKIE = "dd_courier_session";
const CUSTOMER_COOKIE = "dd_customer_session";
const SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET || "danidunner-dev-secret-change-me-in-prod"
);

export type SessionPayload = {
  adminId: number;
  email: string;
  name: string;
  // Optional so tokens signed before this field existed keep decoding —
  // treated as full access everywhere role/station is checked (see
  // proxy.ts and AdminShell.tsx), same as the old single-admin behavior.
  role?: "owner" | "staff";
  station?: "all" | "pizza" | "other";
};

export type CourierSessionPayload = {
  courierId: number;
  name: string;
  phone: string;
};

export type CustomerSessionPayload = {
  customerId: number;
  name: string;
  email: string;
};

async function createToken(payload: Record<string, unknown>): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(SECRET);
}

async function verifyToken<T>(token: string): Promise<T | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as T;
  } catch {
    return null;
  }
}

async function setCookie(name: string, token: string) {
  const store = await cookies();
  store.set(name, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

async function clearCookie(name: string) {
  const store = await cookies();
  store.delete(name);
}

// ---------- Admin sessions ----------

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return createToken(payload);
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  return verifyToken<SessionPayload>(token);
}

export async function setSessionCookie(token: string) {
  await setCookie(ADMIN_COOKIE, token);
}

export async function clearSessionCookie() {
  await clearCookie(ADMIN_COOKIE);
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export const SESSION_COOKIE_NAME = ADMIN_COOKIE;

// Called right after a normal customer login/registration (password or
// Google) succeeds. If the email matches the admin email configured in
// Настройки → Достъп до админ панела, this ALSO mints and sets an admin
// session cookie — so that one email gets into /admin without a separate
// admin_users account. customerId is carried as adminId purely so the
// admin session payload has a real, traceable id; nothing looks it up
// against admin_users. Returns whether admin access was granted, so the
// caller can redirect to /admin instead of the normal account page.
export async function maybeGrantAdminAccess(
  email: string,
  name: string,
  customerId: number
): Promise<boolean> {
  const settings = await getSettings();
  const adminEmail = settings.admin_email.trim().toLowerCase();
  if (!adminEmail || email.trim().toLowerCase() !== adminEmail) return false;
  const token = await createSessionToken({
    adminId: customerId,
    email,
    name,
    role: "owner",
    station: "all",
  });
  await setSessionCookie(token);
  return true;
}

// ---------- Courier sessions ----------

export async function createCourierSessionToken(
  payload: CourierSessionPayload
): Promise<string> {
  return createToken(payload);
}

export async function verifyCourierSessionToken(
  token: string
): Promise<CourierSessionPayload | null> {
  return verifyToken<CourierSessionPayload>(token);
}

export async function setCourierSessionCookie(token: string) {
  await setCookie(COURIER_COOKIE, token);
}

export async function clearCourierSessionCookie() {
  await clearCookie(COURIER_COOKIE);
}

export async function getCourierSession(): Promise<CourierSessionPayload | null> {
  const store = await cookies();
  const token = store.get(COURIER_COOKIE)?.value;
  if (!token) return null;
  return verifyCourierSessionToken(token);
}

export const COURIER_COOKIE_NAME = COURIER_COOKIE;

// ---------- Customer sessions ----------

export async function createCustomerSessionToken(
  payload: CustomerSessionPayload
): Promise<string> {
  return createToken(payload);
}

export async function verifyCustomerSessionToken(
  token: string
): Promise<CustomerSessionPayload | null> {
  return verifyToken<CustomerSessionPayload>(token);
}

export async function setCustomerSessionCookie(token: string) {
  await setCookie(CUSTOMER_COOKIE, token);
}

export async function clearCustomerSessionCookie() {
  await clearCookie(CUSTOMER_COOKIE);
}

export async function getCustomerSession(): Promise<CustomerSessionPayload | null> {
  const store = await cookies();
  const token = store.get(CUSTOMER_COOKIE)?.value;
  if (!token) return null;
  return verifyCustomerSessionToken(token);
}

export const CUSTOMER_COOKIE_NAME = CUSTOMER_COOKIE;
