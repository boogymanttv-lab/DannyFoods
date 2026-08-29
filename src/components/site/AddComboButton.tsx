"use client";

import { useCart } from "@/lib/cart-context";

// A promo card built from the combo picker (see PromoCardsManager) skips
// the usual "click through to /oferti" — this adds its linked product
// straight to the cart instead, at quantity 1, no size/extras (the combo's
// price is already final). Renders as a <button> wrapping arbitrary card
// markup so the whole card (or just a CTA inside it) can be the trigger —
// a button may contain block content, so this is valid in either position.
export function AddComboButton({
  productId,
  name,
  image,
  price,
  className,
  children,
}: {
  productId: number;
  name: string;
  image: string;
  price: number;
  className?: string;
  children: React.ReactNode;
}) {
  const { addLine } = useCart();
  return (
    <button
      type="button"
      onClick={() =>
        addLine({
          productId,
          name,
          image,
          unitPrice: price,
          quantity: 1,
          extras: [],
        })
      }
      className={className}
    >
      {children}
    </button>
  );
}
