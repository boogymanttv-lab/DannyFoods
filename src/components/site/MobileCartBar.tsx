"use client";

import { useCart } from "@/lib/cart-context";
import { formatPrice } from "@/lib/format";

export function MobileCartBar() {
  const { itemCount, subtotal, openDrawer } = useCart();

  if (itemCount === 0) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 md:hidden px-3 pb-3 animate-slide-up">
      <button
        onClick={openDrawer}
        className="w-full bg-brand text-white rounded-2xl shadow-lg shadow-brand/30 px-4 py-3.5 flex items-center justify-between font-semibold"
      >
        <span className="flex items-center gap-2">
          <span className="bg-white/20 rounded-full h-6 w-6 grid place-items-center text-xs font-bold">
            {itemCount}
          </span>
          Виж количката
        </span>
        <span>{formatPrice(subtotal)}</span>
      </button>
    </div>
  );
}
