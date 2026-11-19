"use client";

import { useEffect } from "react";
import { useCart } from "@/lib/cart-context";

export function ClearCartOnPaid() {
  const { clear } = useCart();
  useEffect(() => {
    clear();
  }, [clear]);
  return null;
}
