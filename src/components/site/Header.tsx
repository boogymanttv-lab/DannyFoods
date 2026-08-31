"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart-context";
import { useT } from "@/lib/i18n/LocaleProvider";
import { LocaleSwitcher } from "@/components/site/LocaleSwitcher";

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
  const t = useT();

  return (
    <header className="sticky top-0 z-40 bg-gradient-to-b from-accent-dark to-[#141414] text-white border-b border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.35)]">
      <div className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={siteName}
              className="h-10 w-10 rounded-full object-cover ring-2 ring-gold/40 shadow-[0_0_14px_rgba(245,166,35,0.35)]"
            />
          ) : (
            <span className="h-10 w-10 rounded-full bg-gradient-to-br from-brand to-brand-dark text-white grid place-items-center font-display font-extrabold text-lg ring-2 ring-gold/30 shadow-[0_0_14px_rgba(225,29,46,0.45)]">
              {siteName.slice(0, 1)}
            </span>
          )}
          <span className="font-display font-extrabold text-xl tracking-tight hidden sm:inline">
            {siteName}
          </span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-4">
          <LocaleSwitcher />

          <a
            href={`tel:${phone.replace(/\s/g, "")}`}
            className="hidden md:flex items-center gap-2 text-sm font-semibold text-white/80 hover:text-gold"
          >
            📞 {phone}
          </a>

          <Link
            href={loggedIn ? "/account" : "/account/login"}
            className="hidden sm:flex items-center gap-1.5 text-sm font-semibold text-white/80 hover:text-gold"
          >
            <span aria-hidden>👤</span>
            <span>{loggedIn ? t("nav.account") : t("nav.login")}</span>
          </Link>
          <Link
            href={loggedIn ? "/account" : "/account/login"}
            aria-label={loggedIn ? t("nav.account") : t("nav.login")}
            className="sm:hidden h-10 w-10 rounded-full bg-white/10 grid place-items-center text-lg hover:bg-white/20 hover:shadow-[0_0_14px_rgba(245,166,35,0.3)] transition-all"
          >
            <span aria-hidden>👤</span>
          </Link>

          <button
            onClick={openDrawer}
            aria-label={t("nav.cart")}
            className="relative h-10 w-10 rounded-full bg-white/10 grid place-items-center text-lg hover:bg-white/20 hover:shadow-[0_0_14px_rgba(245,166,35,0.3)] transition-all"
          >
            <span aria-hidden>🛒</span>
            {itemCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-gradient-to-br from-brand-light to-brand text-white text-xs font-bold rounded-full h-5 w-5 grid place-items-center shadow-[0_0_8px_rgba(225,29,46,0.6)]">
                {itemCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
