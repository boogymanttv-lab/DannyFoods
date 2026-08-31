"use client";

import { useMemo, useState } from "react";
import { formatPrice, getDisplayPrice } from "@/lib/format";
import { ProductModal } from "@/components/site/ProductModal";
import { useT } from "@/lib/i18n/LocaleProvider";
import type { Category, ProductWithOptions } from "@/lib/types";

export function MenuBrowser({
  categories,
  products,
  suggestedCategoryId,
  ratings,
}: {
  categories: Category[];
  products: ProductWithOptions[];
  // Category id (as a string, matching the site_settings store) whose
  // products should show as "Често купувано с" suggestions in the product
  // modal — empty string/undefined disables the section entirely.
  suggestedCategoryId?: string;
  // Precomputed per-product review averages (one query for the whole menu,
  // rather than one per card) — a product with no reviews just has no entry.
  ratings?: Record<number, { average: number; count: number }>;
}) {
  const t = useT();
  const [activeSlug, setActiveSlug] = useState(categories[0]?.slug ?? "");
  const [selectedProduct, setSelectedProduct] = useState<ProductWithOptions | null>(
    null
  );

  const suggestions = useMemo(() => {
    if (!suggestedCategoryId) return [];
    return products.filter((p) => String(p.category_id) === suggestedCategoryId);
  }, [products, suggestedCategoryId]);

  const grouped = useMemo(() => {
    const map = new Map<number, ProductWithOptions[]>();
    for (const p of products) {
      if (!map.has(p.category_id)) map.set(p.category_id, []);
      map.get(p.category_id)!.push(p);
    }
    return map;
  }, [products]);

  const activeCategory = categories.find((c) => c.slug === activeSlug) ?? categories[0];
  const items = activeCategory ? grouped.get(activeCategory.id) ?? [] : [];

  function selectCategory(slug: string) {
    setActiveSlug(slug);
    // A category switch always starts a fresh grid — jump back to the top
    // of the menu so the new selection is never confused with leftover
    // scroll position from a longer previous list.
    document.getElementById("menu")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div id="menu">
      <div className="sticky top-16 z-30 bg-background/95 backdrop-blur border-b border-border shadow-[0_4px_16px_rgba(0,0,0,0.04)]">
        <div className="mx-auto max-w-6xl px-4 py-3 flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              key={c.slug}
              onClick={() => selectCategory(c.slug)}
              className={`rounded-full px-4 py-2 text-sm font-semibold border transition-all ${
                activeSlug === c.slug
                  ? "bg-gradient-to-r from-brand to-brand-dark text-white border-brand shadow-[0_6px_16px_rgba(225,29,46,0.35)] -translate-y-0.5"
                  : "bg-surface border-border text-foreground/70 shadow-sm hover:shadow-md hover:-translate-y-0.5"
              }`}
            >
              <span className="mr-1">{c.icon}</span>
              {c.name}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-8">
        {activeCategory && (
          <div key={activeCategory.slug} className="animate-pop-in">
            <h2 className="font-display font-extrabold text-2xl mb-5 flex items-center gap-2">
              <span className="drop-shadow-[0_2px_6px_rgba(225,29,46,0.15)]">{activeCategory.icon}</span>{" "}
              <span className="bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
                {activeCategory.name}
              </span>
            </h2>

            {items.length === 0 ? (
              <p className="text-muted text-center py-16">{t("menu.empty")}</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
                {items.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedProduct(p)}
                    className="group text-left bg-surface rounded-xl sm:rounded-2xl border border-border overflow-hidden shadow-sm hover:shadow-[0_16px_32px_rgba(0,0,0,0.12)] hover:-translate-y-1 transition-all duration-200 flex flex-col"
                  >
                    <div className="relative aspect-square bg-gradient-to-br from-brand/10 to-gold/10 grid place-items-center overflow-hidden">
                      {p.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.image}
                          alt={p.name}
                          loading="lazy"
                          decoding="async"
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <span className="text-3xl sm:text-5xl">{activeCategory.icon}</span>
                      )}
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-black/15 to-transparent" />
                      {p.featured === 1 && (
                        <span className="absolute top-1.5 right-1.5 sm:top-2.5 sm:right-2.5 inline-flex items-center gap-0.5 text-[11px] sm:text-sm font-extrabold text-white bg-gradient-to-br from-brand-light to-brand-dark px-2 sm:px-3 py-1 sm:py-1.5 rounded-full shadow-[0_4px_14px_rgba(225,29,46,0.55)] rotate-[-6deg]">
                          🔥 HOT
                        </span>
                      )}
                    </div>
                    <div className="p-2.5 sm:p-4 flex-1 flex flex-col">
                      <div className="flex items-start justify-between gap-1.5">
                        <h3 className="font-semibold leading-tight text-xs sm:text-base">
                          {p.name}
                          {(() => {
                            const defaultSize =
                              p.sizes.find((s) => s.is_default) ??
                              [...p.sizes].sort((a, b) => a.price_delta - b.price_delta)[0];
                            return defaultSize?.weight_label ? (
                              <span className="ml-1 font-normal text-muted text-[10px] sm:text-xs">
                                ({defaultSize.weight_label})
                              </span>
                            ) : null;
                          })()}
                        </h3>
                      </div>
                      {ratings?.[p.id] && ratings[p.id].count > 0 && (
                        <span className="flex items-center gap-1 text-[10px] sm:text-xs text-muted mt-0.5">
                          <span className="text-gold">★</span>
                          {ratings[p.id].average.toFixed(1)} ({ratings[p.id].count})
                        </span>
                      )}
                      {p.description && (
                        <p className="text-[11px] sm:text-xs text-muted mt-1 line-clamp-2 flex-1">
                          {p.description}
                        </p>
                      )}
                      <span className="mt-1.5 sm:mt-3 font-bold text-brand text-xs sm:text-base">
                        {(() => {
                          const { price, fromMultiple } = getDisplayPrice(p);
                          return fromMultiple
                            ? `${t("menu.from")} ${formatPrice(price)}`
                            : formatPrice(price);
                        })()}
                      </span>
                    </div>
                    <span className="block text-center text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-brand to-brand-dark py-1.5 sm:py-2.5 group-hover:from-brand-light group-hover:to-brand transition-colors">
                      {t("menu.select")}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {selectedProduct && (
        <ProductModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          suggestions={suggestions.filter((p) => p.id !== selectedProduct.id)}
        />
      )}
    </div>
  );
}
