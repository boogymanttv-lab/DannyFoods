import { cookies } from "next/headers";
import type { Locale } from "@/lib/i18n/dict";

export const LOCALE_COOKIE = "dd_locale";

// Server-side read of the visitor's chosen language — defaults to Bulgarian
// (the site's native language) when no cookie is set yet, e.g. a first-time
// visitor. Set via POST /api/locale (see LocaleSwitcher.tsx).
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return value === "en" ? "en" : "bg";
}
