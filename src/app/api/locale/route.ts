import { NextRequest, NextResponse } from "next/server";
import { LOCALE_COOKIE } from "@/lib/i18n/locale";

// Sets the visitor's language cookie — called by LocaleProvider whenever the
// switcher is clicked. Deliberately tiny: no validation beyond "en" vs
// anything else, since an invalid value just falls back to Bulgarian on the
// next read (see getLocale()).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const locale = body?.locale === "en" ? "en" : "bg";
  const res = NextResponse.json({ ok: true, locale });
  res.cookies.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  return res;
}
