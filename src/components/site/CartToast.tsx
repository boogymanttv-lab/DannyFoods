"use client";

import { useEffect, useState } from "react";
import { useCart } from "@/lib/cart-context";
import { useT } from "@/lib/i18n/LocaleProvider";

const VISIBLE_MS = 3000;

export function CartToast() {
  const { lastAdded, openDrawer } = useCart();
  const t = useT();
  const [hiddenId, setHiddenId] = useState<number | null>(null);

  useEffect(() => {
    if (!lastAdded) return;
    const id = lastAdded.id;
    const timer = setTimeout(() => setHiddenId(id), VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [lastAdded]);

  if (!lastAdded || hiddenId === lastAdded.id) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-24 md:bottom-8 z-[999] flex justify-center px-4 pointer-events-none"
    >
      <div className="pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl bg-accent-dark px-4 py-3 text-white shadow-[0_12px_32px_rgba(0,0,0,0.45)] animate-pop-in">
        <span
          aria-hidden
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-success text-sm font-extrabold"
        >
          ✓
        </span>
        <p className="text-sm font-semibold leading-snug">
          {t("cart.added")} <span className="text-gold">{lastAdded.name}</span>
        </p>
        <button
          type="button"
          onClick={() => {
            setHiddenId(lastAdded.id);
            openDrawer();
          }}
          className="shrink-0 rounded-lg bg-brand px-3 py-1.5 text-xs font-bold"
        >
          {t("cart.viewCart")}
        </button>
      </div>
    </div>
  );
}
