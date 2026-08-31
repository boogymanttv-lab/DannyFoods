import { NextRequest, NextResponse } from "next/server";
import { getSettings } from "@/lib/repos/settings";
import {
  getCustomerByGoogleId,
  getCustomerByEmail,
  createCustomer,
  updateCustomer,
} from "@/lib/repos/customers";
import {
  createCustomerSessionToken,
  setCustomerSessionCookie,
  maybeGrantAdminAccess,
} from "@/lib/auth";

const NONCE_COOKIE = "dd_google_oauth_nonce";

type GoogleTokenInfo = {
  aud: string;
  sub: string;
  email?: string;
  email_verified?: string | boolean;
  name?: string;
  picture?: string;
};

export async function GET(req: NextRequest) {
  const fail = (reason: string) =>
    NextResponse.redirect(new URL(`/account/login?error=${reason}`, req.url));

  const settings = await getSettings();
  if (!settings.google_client_id || !settings.google_client_secret) {
    return fail("google_not_configured");
  }

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  if (req.nextUrl.searchParams.get("error") || !code || !state) {
    return fail("google_failed");
  }

  const [statedNonce, encodedRedirect] = state.split(":");
  const cookieNonce = req.cookies.get(NONCE_COOKIE)?.value;
  if (!cookieNonce || cookieNonce !== statedNonce) {
    return fail("google_failed");
  }
  const redirectPath = encodedRedirect ? decodeURIComponent(encodedRedirect) : "/account";
  const safeRedirect = redirectPath.startsWith("/") ? redirectPath : "/account";

  const redirectUri = `${req.nextUrl.origin}/api/account/google/callback`;

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: settings.google_client_id,
        client_secret: settings.google_client_secret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    if (!tokenRes.ok) return fail("google_failed");
    const tokenData = (await tokenRes.json()) as { id_token?: string };
    if (!tokenData.id_token) return fail("google_failed");

    // Verifying via Google's tokeninfo endpoint (rather than checking the
    // JWT signature ourselves) keeps this simple and still confirms the
    // token is genuinely Google's and issued for our client ID.
    const infoRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(tokenData.id_token)}`
    );
    if (!infoRes.ok) return fail("google_failed");
    const info = (await infoRes.json()) as GoogleTokenInfo;

    if (info.aud !== settings.google_client_id) return fail("google_failed");
    if (!info.email || String(info.email_verified) !== "true") return fail("google_email");

    let customer = await getCustomerByGoogleId(info.sub);
    if (!customer) {
      const byEmail = await getCustomerByEmail(info.email);
      if (byEmail) {
        // Same person already has a password account with this email —
        // link Google to it instead of creating a duplicate.
        await updateCustomer(byEmail.id, {
          google_id: info.sub,
          avatar_url: info.picture ?? byEmail.avatar_url,
        });
        customer = { ...byEmail, google_id: info.sub };
      } else {
        const id = await createCustomer({
          name: info.name || info.email.split("@")[0],
          email: info.email,
          google_id: info.sub,
          avatar_url: info.picture ?? "",
        });
        customer = {
          id,
          name: info.name || info.email.split("@")[0],
          email: info.email,
          phone: "",
          password_hash: null,
          google_id: info.sub,
          avatar_url: info.picture ?? "",
          stripe_customer_id: null,
          created_at: new Date().toISOString(),
        };
      }
    }

    const token = await createCustomerSessionToken({
      customerId: customer.id,
      name: customer.name,
      email: customer.email,
    });
    await setCustomerSessionCookie(token);

    // If this Google account's email matches the configured admin email,
    // also grant admin access and land them in /admin instead of wherever
    // the normal customer flow was headed.
    const isAdmin = await maybeGrantAdminAccess(customer.email, customer.name, customer.id);
    const res = NextResponse.redirect(new URL(isAdmin ? "/admin" : safeRedirect, req.url));
    res.cookies.delete(NONCE_COOKIE);
    return res;
  } catch (err) {
    console.error("Google OAuth callback error", err);
    return fail("google_failed");
  }
}
