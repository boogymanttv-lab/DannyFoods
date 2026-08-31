// Picks the right-language copy of database CONTENT (product/category/promo
// names & descriptions) — separate from the static UI-chrome dictionary in
// dict.ts. Content translation comes from the _en columns auto-filled by
// DeepL when an admin saves an item (see src/lib/translate.ts); an empty
// _en value (not yet translated, or translation not configured) falls back
// to showing the Bulgarian text rather than a blank field.
import type { Locale } from "@/lib/i18n/dict";
import type { Category, Product, ProductWithOptions, PromoCard } from "@/lib/types";

export function localizeCategory<T extends Category>(c: T, locale: Locale): T {
  if (locale === "bg") return c;
  return { ...c, name: c.name_en || c.name };
}

export function localizeProduct<T extends Product | ProductWithOptions>(p: T, locale: Locale): T {
  if (locale === "bg") return p;
  return { ...p, name: p.name_en || p.name, description: p.description_en || p.description };
}

export function localizePromoCard<T extends PromoCard>(c: T, locale: Locale): T {
  if (locale === "bg") return c;
  return {
    ...c,
    title: c.title_en || c.title,
    description: c.description_en || c.description,
  };
}
