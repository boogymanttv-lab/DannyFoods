import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { getSettings } from "@/lib/repos/settings";

const NONCE_COOKIE = "dd_google_oauth_nonce";

// Kicks off "Вход с Google": redirects the browser to Google's consent
// screen. Requires the site owner to have created a Google Cloud OAuth
// client and pasted its Client ID/Secret into Admin → Настройки — see the
// README for the exact steps. If it isn't configured yet, we don't have
// anywhere useful to send the user, so we bounce back to the login form
// with an error instead of redirecting to a Google URL that will fail.
export async function GET(req: NextRequest) {
  const settings = await getSettings();
  if (!settings.google_client_id) {
    return NextResponse.redirect(
      new URL("/account/login?error=google_not_configured", req.url)
    );
  }

  const requestedRedirect = req.nextUrl.searchParams.get("redirect") || "/account";
  // Only ever allow a same-site relative path — never let this become an
  // open redirect to an attacker-controlled URL.
  const safeRedirect = requestedRedirect.startsWith("/") ? requestedRedirect : "/account";

  const nonce = crypto.randomBytes(16).toString("hex");
  const state = `${nonce}:${encodeURIComponent(safeRedirect)}`;

  const redirectUri = `${req.nextUrl.origin}/api/account/google/callback`;
  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", settings.google_client_id);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "openid email profile");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("prompt", "select_account");

  const res = NextResponse.redirect(authUrl.toString());
  res.cookies.set(NONCE_COOKIE, nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
