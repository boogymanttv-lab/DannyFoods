"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart-context";
import { formatPrice } from "@/lib/format";

export function CartDrawer() {
  const { lines, isDrawerOpen, closeDrawer, updateQuantity, keyOf, subtotal } =
    useCart();

  if (!isDrawerOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        aria-label="Затвори количката"
        className="absolute inset-0 bg-black/40"
        onClick={closeDrawer}
      />
      <div className="relative w-full sm:max-w-md h-full bg-surface flex flex-col animate-slide-up sm:animate-none shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-display font-bold text-lg">Вашата количка</h2>
          <button
            onClick={closeDrawer}
            className="h-9 w-9 rounded-full bg-black/5 grid place-items-center text-lg"
            aria-label="Затвори"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {lines.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-muted gap-2 py-16">
              <span className="text-4xl">🛒</span>
              <p>Количката е празна</p>
            </div>
          ) : (
            <ul className="space-y-4">
              {lines.map((line) => {
                const key = keyOf(line);
                const extrasTotal = line.extras.reduce((s, e) => s + e.price, 0);
                const lineTotal = (line.unitPrice + extrasTotal) * line.quantity;
                return (
                  <li key={key} className="flex gap-3 border-b border-border pb-4">
                    <div className="h-16 w-16 rounded-xl bg-black/5 shrink-0 overflow-hidden grid place-items-center text-2xl">
                      {line.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={line.image}
                          alt={line.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        "🍽️"
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm leading-tight">
                        {line.name}
                        {line.sizeLabel ? ` · ${line.sizeLabel}` : ""}
                      </p>
                      {line.extras.length > 0 && (
                        <p className="text-xs text-muted mt-0.5 truncate">
                          + {line.extras.map((e) => e.name).join(", ")}
                        </p>
                      )}
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-2 bg-black/5 rounded-full px-1">
                          <button
                            className="h-7 w-7 grid place-items-center font-bold"
                            onClick={() => updateQuantity(key, line.quantity - 1)}
                          >
                            −
                          </button>
                          <span className="text-sm font-semibold w-4 text-center">
                            {line.quantity}
                          </span>
                          <button
                            className="h-7 w-7 grid place-items-center font-bold"
                            onClick={() => updateQuantity(key, line.quantity + 1)}
                          >
                            +
                          </button>
                        </div>
                        <span className="font-bold text-sm">
                          {formatPrice(lineTotal)}
                        </span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {lines.length > 0 && (
          <div className="border-t border-border p-5 space-y-3">
            <div className="flex justify-between font-semibold">
              <span>Междинна сума</span>
              <span>{formatPrice(subtotal)}</span>
            </div>
            <Link
              href="/checkout"
              onClick={closeDrawer}
              className="block text-center w-full bg-brand text-white rounded-xl py-3.5 font-bold hover:bg-brand-dark transition-colors"
            >
              Продължи към поръчка
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
