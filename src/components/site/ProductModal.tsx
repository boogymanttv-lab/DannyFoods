"use client";

import { useMemo, useState } from "react";
import { useCart } from "@/lib/cart-context";
import { formatPrice } from "@/lib/format";
import type { ProductWithOptions } from "@/lib/types";

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
  const defaultSize =
    product.sizes.find((s) => s.is_default) ?? product.sizes[0] ?? null;
  const [sizeId, setSizeId] = useState<number | null>(defaultSize?.id ?? null);
  const [extraIds, setExtraIds] = useState<number[]>([]);
  const [quantity, setQuantity] = useState(1);

  const selectedSize = product.sizes.find((s) => s.id === sizeId) ?? null;
  const selectedExtras = product.extras.filter((e) => extraIds.includes(e.id));

  const unitPrice = useMemo(
    () => product.base_price + (selectedSize?.price_delta ?? 0),
    [product.base_price, selectedSize]
  );
  const extrasTotal = selectedExtras.reduce((s, e) => s + e.price, 0);
  const totalPrice = (unitPrice + extrasTotal) * quantity;

  function toggleExtra(id: number) {
    setExtraIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
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
      extras: selectedExtras.map((e) => ({ id: e.id, name: e.name, price: e.price })),
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
        <div className="h-48 bg-gradient-to-br from-brand/20 to-gold/20 relative grid place-items-center">
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
            <h3 className="font-display font-extrabold text-xl">{product.name}</h3>
            {product.description && (
              <p className="text-sm text-muted mt-1">{product.description}</p>
            )}
          </div>

          {product.sizes.length > 1 && (
            <div>
              <p className="font-semibold text-sm mb-2">Размер</p>
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
                    <div>{s.label}</div>
                    <div className="text-xs text-muted font-normal">
                      {formatPrice(product.base_price + s.price_delta)}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {product.extras.length > 0 && (
            <div>
              <p className="font-semibold text-sm mb-2">Добавки</p>
              <div className="space-y-2">
                {product.extras.map((e) => (
                  <label
                    key={e.id}
                    className="flex items-center justify-between rounded-xl border border-border px-3 py-2.5 text-sm cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={extraIds.includes(e.id)}
                        onChange={() => toggleExtra(e.id)}
                        className="accent-[var(--brand)] h-4 w-4"
                      />
                      {e.name}
                    </span>
                    <span className="text-muted">+{formatPrice(e.price)}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="font-semibold text-sm mb-2">Количество</p>
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

          {suggestions.length > 0 && (
            <div>
              <p className="font-semibold text-sm mb-2">Често купувано с</p>
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
            <span>Добави в количката</span>
            <span>{formatPrice(totalPrice)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
