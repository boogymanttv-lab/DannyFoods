"use client";

import { useMemo, useState } from "react";
import { useCart } from "@/lib/cart-context";
import { formatPrice } from "@/lib/format";
import { ProductReviews } from "@/components/site/ProductReviews";
import { useT } from "@/lib/i18n/LocaleProvider";
import type { ProductWithOptions } from "@/lib/types";

// The description is written as a comma-separated ingredient list (e.g.
// "Барбекю сос, Телешка кайма, Дюнер месо, Кис.краставички, Чедър, Пушено
// сирене, Моцарела") — reused here as the source for "Без —" checkboxes so
// there's nothing extra for the admin to maintain per product.
function parseIngredients(description: string): string[] {
  return description
    .split(",")
    .map((s) => s.trim().replace(/\.$/, ""))
    .filter(Boolean);
}

export function ProductModal({
  product,
  onClose,
  suggestions = [],
}: {
  product: ProductWithOptions;
  onClose: () => void;
  // Other products (e.g. drinks) to suggest as "Често купувано с" — admin-
  // configured in Настройки by picking a whole category.
  suggestions?: ProductWithOptions[];
}) {
  const { addLine, openDrawer } = useCart();
  const t = useT();
  const defaultSize =
    product.sizes.find((s) => s.is_default) ?? product.sizes[0] ?? null;
  const [sizeId, setSizeId] = useState<number | null>(defaultSize?.id ?? null);
  // Keyed by extra id. Presence of a key means that extra is checked/on;
  // the value is the chosen ExtraOption id when that extra has variants
  // (e.g. Шунка 50г/100г/150г/200г), or null for a plain flat-price extra.
  const [selectedExtras, setSelectedExtras] = useState<Record<number, number | null>>({});
  const [quantity, setQuantity] = useState(1);
  const ingredients = useMemo(
    () => parseIngredients(product.description),
    [product.description]
  );
  // Holds ingredients the customer wants LEFT OUT — unchecked by default
  // (nothing removed) since most orders want everything as described.
  const [removedIngredients, setRemovedIngredients] = useState<Set<string>>(new Set());

  const selectedSize = product.sizes.find((s) => s.id === sizeId) ?? null;

  const unitPrice = useMemo(
    () => product.base_price + (selectedSize?.price_delta ?? 0),
    [product.base_price, selectedSize]
  );

  // Resolves each checked extra to its actual name/price right now — used
  // both for the running total and for what actually gets added to cart.
  const resolvedExtras = product.extras
    .filter((e) => e.id in selectedExtras)
    .map((e) => {
      const optionId = selectedExtras[e.id];
      const option = optionId != null ? e.options.find((o) => o.id === optionId) : null;
      return {
        id: e.id,
        name: option ? `${e.name} (${option.label})` : e.name,
        price: option ? option.price : e.price,
        optionId: option?.id,
      };
    });
  const extrasTotal = resolvedExtras.reduce((s, e) => s + e.price, 0);
  const totalPrice = (unitPrice + extrasTotal) * quantity;

  function toggleExtra(extraId: number) {
    setSelectedExtras((prev) => {
      if (extraId in prev) {
        const next = { ...prev };
        delete next[extraId];
        return next;
      }
      const extra = product.extras.find((e) => e.id === extraId);
      const defaultOption =
        extra?.options.find((o) => o.is_default) ?? extra?.options[0] ?? null;
      return { ...prev, [extraId]: defaultOption?.id ?? null };
    });
  }

  function chooseExtraOption(extraId: number, optionId: number) {
    setSelectedExtras((prev) => ({ ...prev, [extraId]: optionId }));
  }

  function toggleIngredient(ingredient: string) {
    setRemovedIngredients((prev) => {
      const next = new Set(prev);
      if (next.has(ingredient)) next.delete(ingredient);
      else next.add(ingredient);
      return next;
    });
  }

  function handleAdd() {
    addLine({
      productId: product.id,
      name: product.name,
      image: product.image,
      sizeLabel: selectedSize?.label,
      sizeId: selectedSize?.id,
      unitPrice,
      quantity,
      extras: resolvedExtras,
      removedIngredients:
        removedIngredients.size > 0 ? Array.from(removedIngredients) : undefined,
    });
    onClose();
    openDrawer();
  }

  function handleAddSuggestion(suggestion: ProductWithOptions) {
    const size = suggestion.sizes.find((s) => s.is_default) ?? suggestion.sizes[0] ?? null;
    addLine({
      productId: suggestion.id,
      name: suggestion.name,
      image: suggestion.image,
      sizeLabel: size?.label,
      sizeId: size?.id,
      unitPrice: suggestion.base_price + (size?.price_delta ?? 0),
      quantity: 1,
      extras: [],
    });
    openDrawer();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <button
        aria-label="Затвори"
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <div className="relative bg-surface w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl max-h-[90vh] overflow-y-auto animate-slide-up sm:animate-pop-in">
        <div className="aspect-[4/3] bg-gradient-to-br from-brand/20 to-gold/20 relative grid place-items-center">
          {product.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.image}
              alt={product.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="text-6xl">🍽️</span>
          )}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 h-9 w-9 rounded-full bg-white/90 grid place-items-center text-lg shadow"
            aria-label="Затвори"
          >
            ✕
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div>
            <h3 className="font-display font-extrabold text-xl">
              {product.name}
              {selectedSize?.weight_label && (
                <span className="ml-2 font-normal text-muted text-sm align-middle">
                  ({selectedSize.weight_label})
                </span>
              )}
            </h3>
            {product.description && (
              <p className="text-sm text-muted mt-1">{product.description}</p>
            )}
          </div>

          {product.sizes.length > 1 && (
            <div>
              <p className="font-semibold text-sm mb-2">{t("product.size")}</p>
              <div className="grid grid-cols-2 gap-2">
                {product.sizes.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSizeId(s.id)}
                    className={`rounded-xl border px-3 py-2.5 text-sm font-semibold text-left transition-colors ${
                      sizeId === s.id
                        ? "border-brand bg-brand/5 text-brand"
                        : "border-border"
                    }`}
                  >
                    <div>
                      {s.label}
                      {s.weight_label && (
                        <span className="ml-1 font-normal text-muted text-xs">
                          ({s.weight_label})
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted font-normal">
                      {formatPrice(product.base_price + s.price_delta)}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {ingredients.length > 0 && (
            <div>
              <p className="font-semibold text-sm mb-2">{t("product.removeIngredients")}</p>
              {/* One row per ingredient, checkbox first — each row reads
                  "Без домати" etc. on its own, rather than a generic "Без —"
                  heading over a strip of bare ingredient chips. */}
              <div className="space-y-2">
                {ingredients.map((ing) => {
                  const isRemoved = removedIngredients.has(ing);
                  return (
                    <label
                      key={ing}
                      className="flex items-center gap-2 rounded-xl border border-border px-3 py-2.5 text-sm cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={isRemoved}
                        onChange={() => toggleIngredient(ing)}
                        className="accent-[var(--brand)] h-4 w-4 shrink-0"
                      />
                      <span
                        className={
                          isRemoved
                            ? "text-brand font-semibold"
                            : "text-foreground/80"
                        }
                      >
                        {t("cart.removedIngredients")} {ing}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {product.extras.length > 0 && (
            <div>
              <p className="font-semibold text-sm mb-2">{t("product.extras")}</p>
              <div className="space-y-2">
                {product.extras.map((e) => {
                  const isChecked = e.id in selectedExtras;
                  const selectedOptionId = selectedExtras[e.id] ?? null;
                  const displayPrice =
                    e.options.length > 0
                      ? (e.options.find((o) => o.id === selectedOptionId) ?? e.options[0])
                          ?.price ?? 0
                      : e.price;
                  return (
                    <div
                      key={e.id}
                      className="rounded-xl border border-border overflow-hidden"
                    >
                      <label className="flex items-center justify-between px-3 py-2.5 text-sm cursor-pointer">
                        <span className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleExtra(e.id)}
                            className="accent-[var(--brand)] h-4 w-4"
                          />
                          {e.name}
                        </span>
                        <span className="text-muted">+{formatPrice(displayPrice)}</span>
                      </label>
                      {isChecked && e.options.length > 0 && (
                        <div className="border-t border-border px-2 py-2 space-y-1 bg-black/[0.03]">
                          {e.options.map((o) => (
                            <button
                              key={o.id}
                              type="button"
                              onClick={() => chooseExtraOption(e.id, o.id)}
                              className={`w-full flex items-center justify-between rounded-lg px-2.5 py-2 text-xs text-left transition-colors ${
                                selectedOptionId === o.id
                                  ? "bg-brand/10 text-brand font-semibold"
                                  : "text-foreground/70"
                              }`}
                            >
                              <span>
                                {selectedOptionId === o.id ? "✓ " : ""}
                                {o.label}
                              </span>
                              <span>{formatPrice(o.price)}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <p className="font-semibold text-sm mb-2">{t("product.quantity")}</p>
            <div className="flex items-center gap-3 bg-black/5 rounded-full w-fit px-2">
              <button
                className="h-9 w-9 grid place-items-center font-bold text-lg"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              >
                −
              </button>
              <span className="w-6 text-center font-semibold">{quantity}</span>
              <button
                className="h-9 w-9 grid place-items-center font-bold text-lg"
                onClick={() => setQuantity((q) => q + 1)}
              >
                +
              </button>
            </div>
          </div>

          <ProductReviews productId={product.id} />

          {suggestions.length > 0 && (
            <div>
              <p className="font-semibold text-sm mb-2">{t("product.pairsWith")}</p>
              {/* A plain vertical list — one row per suggestion, same pattern
                  as "Добавки" above — rather than a horizontal scroll strip,
                  so nothing gets cut off at the edge and there's no
                  scrolling/dragging needed to see every item. */}
              <div className="space-y-2">
                {suggestions.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5"
                  >
                    <div className="h-10 w-10 shrink-0 rounded-lg bg-gradient-to-br from-brand/10 to-gold/10 grid place-items-center overflow-hidden">
                      {s.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={s.image}
                          alt={s.name}
                          loading="lazy"
                          decoding="async"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-lg">🥤</span>
                      )}
                    </div>
                    <span className="flex-1 min-w-0 text-sm font-semibold truncate">
                      {s.name}
                    </span>
                    <span className="text-sm font-bold text-brand shrink-0">
                      {formatPrice(s.base_price)}
                    </span>
                    <button
                      onClick={() => handleAddSuggestion(s)}
                      aria-label={`Добави ${s.name}`}
                      className="h-7 w-7 rounded-full bg-brand text-white grid place-items-center font-bold text-sm shrink-0"
                    >
                      +
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-surface border-t border-border p-4">
          <button
            onClick={handleAdd}
            className="w-full bg-brand text-white rounded-xl py-3.5 font-bold flex items-center justify-between px-5 hover:bg-brand-dark transition-colors"
          >
            <span>{t("product.addToCart")}</span>
            <span>{formatPrice(totalPrice)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
