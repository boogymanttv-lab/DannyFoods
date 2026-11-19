import type { Locale } from "@/lib/i18n/dict";
import { applyTranslation, translateMany } from "@/lib/i18n/auto";
import type {
  Category,
  DeliveryZone,
  Product,
  ProductWithOptions,
  PromoCard,
  Promotion,
} from "@/lib/types";

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

export async function localizeProductsDeep<T extends ProductWithOptions>(
  products: T[],
  locale: Locale
): Promise<T[]> {
  if (locale === "bg") return products;
  const strings: string[] = [];
  for (const p of products) {
    if (!p.name_en) strings.push(p.name);
    if (!p.description_en) strings.push(p.description);
    for (const s of p.sizes ?? []) strings.push(s.label, s.weight_label);
    for (const e of p.extras ?? []) {
      strings.push(e.name);
      for (const o of e.options ?? []) strings.push(o.label);
    }
  }
  const map = await translateMany(strings);
  const tr = (s: string) => applyTranslation(s ?? "", map);
  return products.map((p) => ({
    ...p,
    name: p.name_en || tr(p.name),
    description: p.description_en || tr(p.description),
    description_bg: p.description,
    sizes: (p.sizes ?? []).map((s) => ({
      ...s,
      label: tr(s.label),
      weight_label: tr(s.weight_label),
    })),
    extras: (p.extras ?? []).map((e) => ({
      ...e,
      name: tr(e.name),
      options: (e.options ?? []).map((o) => ({ ...o, label: tr(o.label) })),
    })),
  }));
}

export async function localizeCategoriesDeep<T extends Category>(
  categories: T[],
  locale: Locale
): Promise<T[]> {
  if (locale === "bg") return categories;
  const map = await translateMany(categories.filter((c) => !c.name_en).map((c) => c.name));
  return categories.map((c) => ({ ...c, name: c.name_en || applyTranslation(c.name, map) }));
}

export async function localizePromoCardsDeep<T extends PromoCard>(
  cards: T[],
  locale: Locale
): Promise<T[]> {
  if (locale === "bg") return cards;
  const strings: string[] = [];
  for (const c of cards) {
    if (!c.title_en) strings.push(c.title);
    if (!c.description_en) strings.push(c.description);
    strings.push(c.badge, c.subtitle);
  }
  const map = await translateMany(strings);
  const tr = (s: string) => applyTranslation(s ?? "", map);
  return cards.map((c) => ({
    ...c,
    title: c.title_en || tr(c.title),
    description: c.description_en || tr(c.description),
    badge: tr(c.badge),
    subtitle: tr(c.subtitle),
  }));
}

export async function localizeZones<T extends DeliveryZone>(zones: T[], locale: Locale): Promise<T[]> {
  if (locale === "bg") return zones;
  const map = await translateMany(zones.map((z) => z.name));
  return zones.map((z) => ({ ...z, name: applyTranslation(z.name, map) }));
}

export async function localizePromotions<T extends Promotion>(
  promotions: T[],
  locale: Locale
): Promise<T[]> {
  if (locale === "bg") return promotions;
  const map = await translateMany(promotions.map((p) => p.description));
  return promotions.map((p) => ({ ...p, description: applyTranslation(p.description, map) }));
}

export async function localizeFields<T extends Record<string, string>>(
  values: T,
  locale: Locale
): Promise<T> {
  if (locale === "bg") return values;
  const map = await translateMany(Object.values(values));
  const out = {} as Record<string, string>;
  for (const [k, v] of Object.entries(values)) out[k] = applyTranslation(v, map);
  return out as T;
}

function splitList(text: string): string[] {
  return text
    .split(",")
    .map((s) => s.trim().replace(/\.$/, ""))
    .filter(Boolean);
}

export async function removedToBulgarian(
  product: Pick<Product, "description" | "description_en">,
  removed: string[]
): Promise<string[]> {
  if (removed.length === 0) return removed;
  const bg = splitList(product.description);
  if (removed.every((r) => bg.includes(r))) return removed;
  let en = product.description_en;
  if (!en) {
    const map = await translateMany([product.description]);
    en = applyTranslation(product.description, map);
  }
  const enList = splitList(en);
  if (enList.length !== bg.length) return removed;
  return removed.map((r) => {
    const i = enList.indexOf(r);
    return i >= 0 ? bg[i] : r;
  });
}
