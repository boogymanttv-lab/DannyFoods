"use client";

import { useCart } from "@/lib/cart-context";

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
