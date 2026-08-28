"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart-context";

export function Header({
  siteName,
  phone,
  logoUrl,
  loggedIn,
}: {
  siteName: string;
  phone: string;
  logoUrl?: string;
  loggedIn?: boolean;
}) {
  const { itemCount, openDrawer } = useCart();

  return (
    <header className="sticky top-0 z-40 bg-surface/95 backdrop-blur border-b border-border">
      <div className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={siteName} className="h-10 w-10 rounded-full object-cover" />
          ) : (
            <span className="h-10 w-10 rounded-full bg-brand text-white grid place-items-center font-display font-extrabold text-lg">
              {siteName.slice(0, 1)}
            </span>
          )}
          <span className="font-display font-extrabold text-xl tracking-tight hidden sm:inline">
            {siteName}
          </span>
        </Link>

        <div className="flex items-center gap-4 sm:gap-6">
          <a
            href={`tel:${phone.replace(/\s/g, "")}`}
            className="hidden md:flex items-center gap-2 text-sm font-semibold text-foreground/80 hover:text-brand"
          >
            📞 {phone}
          </a>

          <Link
            href={loggedIn ? "/account" : "/account/login"}
            className="flex items-center gap-1.5 text-sm font-semibold text-foreground/80 hover:text-brand"
          >
            <span aria-hidden>👤</span>
            <span className="hidden sm:inline">{loggedIn ? "Профил" : "Вход"}</span>
          </Link>

          <button
            onClick={openDrawer}
            className="relative flex items-center gap-2 rounded-full bg-accent-dark text-white px-4 py-2.5 font-semibold text-sm hover:bg-brand transition-colors"
          >
            <span aria-hidden>🛒</span>
            <span className="hidden sm:inline">Количка</span>
            {itemCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-brand text-white text-xs font-bold rounded-full h-5 w-5 grid place-items-center">
                {itemCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
