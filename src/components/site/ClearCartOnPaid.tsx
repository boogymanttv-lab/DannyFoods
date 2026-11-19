"use client";

import { useEffect } from "react";
import { STORAGE_KEY, useCart } from "@/lib/cart-context";

export function ClearCartOnPaid() {
  const { clear } = useCart();
  useEffect(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
    }
    clear();
  }, [clear]);
  return null;
}
