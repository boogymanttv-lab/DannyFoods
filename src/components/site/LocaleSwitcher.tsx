"use client";

import { useLocale } from "@/lib/i18n/LocaleProvider";

// Compact BG/EN toggle for the header — a single pill with two letters
// rather than a dropdown, since there are only ever two languages.
export function LocaleSwitcher() {
  const { locale, setLocale } = useLocale();

  return (
    <div className="flex items-center rounded-full bg-white/10 p-0.5 text-xs font-bold">
      <button
        onClick={() => setLocale("bg")}
        aria-pressed={locale === "bg"}
        className={`px-2 py-1 rounded-full transition-colors ${
          locale === "bg" ? "bg-gold text-accent-dark" : "text-white/70 hover:text-white"
        }`}
      >
        BG
      </button>
      <button
        onClick={() => setLocale("en")}
        aria-pressed={locale === "en"}
        className={`px-2 py-1 rounded-full transition-colors ${
          locale === "en" ? "bg-gold text-accent-dark" : "text-white/70 hover:text-white"
        }`}
      >
        EN
      </button>
    </div>
  );
}
