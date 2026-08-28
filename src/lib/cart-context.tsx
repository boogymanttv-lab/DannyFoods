"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { CartLine } from "@/lib/types";

const STORAGE_KEY = "danidunner_cart_v1";

function lineKey(line: Pick<CartLine, "productId" | "sizeId" | "extras">) {
  const extrasKey = line.extras
    .map((e) => `${e.id}:${e.optionId ?? ""}`)
    .sort()
    .join(",");
  return `${line.productId}-${line.sizeId ?? "default"}-${extrasKey}`;
}

type CartContextValue = {
  lines: CartLine[];
  addLine: (line: CartLine) => void;
  updateQuantity: (key: string, quantity: number) => void;
  removeLine: (key: string) => void;
  clear: () => void;
  keyOf: typeof lineKey;
  subtotal: number;
  itemCount: number;
  isDrawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [isDrawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from localStorage on mount
      if (raw) setLines(JSON.parse(raw));
    } catch {
      // ignore corrupt storage
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      // storage full/unavailable — ignore
    }
  }, [lines, hydrated]);

  const addLine = useCallback((line: CartLine) => {
    setLines((prev) => {
      const key = lineKey(line);
      const existingIdx = prev.findIndex((l) => lineKey(l) === key);
      if (existingIdx >= 0) {
        const next = [...prev];
        next[existingIdx] = {
          ...next[existingIdx],
          quantity: next[existingIdx].quantity + line.quantity,
        };
        return next;
      }
      return [...prev, line];
    });
    setDrawerOpen(true);
  }, []);

  const updateQuantity = useCallback((key: string, quantity: number) => {
    setLines((prev) => {
      if (quantity <= 0) {
        return prev.filter((l) => lineKey(l) !== key);
      }
      return prev.map((l) => (lineKey(l) === key ? { ...l, quantity } : l));
    });
  }, []);

  const removeLine = useCallback((key: string) => {
    setLines((prev) => prev.filter((l) => lineKey(l) !== key));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const subtotal = useMemo(
    () =>
      lines.reduce((sum, l) => {
        const extrasTotal = l.extras.reduce((s, e) => s + e.price, 0);
        return sum + (l.unitPrice + extrasTotal) * l.quantity;
      }, 0),
    [lines]
  );

  const itemCount = useMemo(
    () => lines.reduce((sum, l) => sum + l.quantity, 0),
    [lines]
  );

  const value: CartContextValue = {
    lines,
    addLine,
    updateQuantity,
    removeLine,
    clear,
    keyOf: lineKey,
    subtotal,
    itemCount,
    isDrawerOpen,
    openDrawer: () => setDrawerOpen(true),
    closeDrawer: () => setDrawerOpen(false),
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart трябва да се използва в рамките на CartProvider");
  return ctx;
}
