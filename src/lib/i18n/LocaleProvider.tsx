"use client";

// Client-side locale context — lets any customer-facing client component
// read the current language and translate a UI-chrome string via useT(),
// without prop-drilling `locale` through every component in between
// (MenuBrowser -> ProductModal -> etc). The source of truth is still the
// `dd_locale` cookie (read server-side by getLocale() in locale.ts) — this
// context is just seeded from that same value on first render so client and
// server never disagree.
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DICT, translate, type DictKey, type Locale } from "@/lib/i18n/dict";

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: React.ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const router = useRouter();

  const setLocale = useCallback(
    (next: Locale) => {
      setLocaleState(next);
      // Persist to the cookie so the next server-rendered page (and any
      // full reload) picks up the same language, then refresh so already-
      // mounted server components (product/category names, promo cards)
      // re-render with the new locale's content immediately.
      fetch("/api/locale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: next }),
      })
        .catch(() => {})
        .finally(() => router.refresh());
    },
    [router]
  );

  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  // Falls back to Bulgarian rather than throwing — a handful of client
  // components render both inside and outside the site layout (e.g. shared
  // widgets), and defaulting to the site's native language is always safe.
  if (!ctx) return { locale: "bg", setLocale: () => {} };
  return ctx;
}

export function useT() {
  const { locale } = useLocale();
  return useCallback((key: DictKey) => translate(locale, key), [locale]);
}

export { DICT };
