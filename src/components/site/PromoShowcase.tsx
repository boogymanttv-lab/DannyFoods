import Link from "next/link";
import { promoCardStyle } from "@/lib/promo-card-style";
import type { PromoCard } from "@/lib/types";

// The homepage's 4 fixed "showcase" slots — active ones only (see
// listActivePromoCards). No photos here on purpose: each card gets a
// distinct built-in gradient + icon (see promo-card-style.ts) instead of an
// upload, so the "cool" factor comes from the design itself rather than
// depending on the admin having a matching product photo ready. Every card
// links to /oferti, the single page listing all currently active cards
// with their fuller description, rather than each card having its own
// separate destination — these work as one themed "offers" section, not
// individual product shortcuts (already covered by the regular menu).
export function PromoShowcase({ cards }: { cards: PromoCard[] }) {
  if (cards.length === 0) return null;

  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 sm:pt-8">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="font-display font-extrabold text-lg sm:text-xl">Оферти на деня</h2>
        <Link href="/oferti" className="text-xs sm:text-sm font-bold text-brand">
          Всички →
        </Link>
      </div>
      <div
        className={`grid gap-3 sm:gap-4 ${
          cards.length === 1
            ? "grid-cols-1"
            : cards.length === 2
              ? "grid-cols-2"
              : cards.length === 3
                ? "grid-cols-2 sm:grid-cols-3"
                : "grid-cols-2 sm:grid-cols-4"
        }`}
      >
        {cards.map((card) => {
          const style = promoCardStyle(card.position);
          return (
            <Link
              key={card.id}
              href="/oferti"
              className={`group relative aspect-square rounded-2xl overflow-hidden bg-gradient-to-br ${style.gradient} shadow-[0_10px_24px_-10px_rgba(20,10,8,0.4)] hover:shadow-[0_18px_34px_-10px_rgba(20,10,8,0.55)] hover:-translate-y-1 transition-all duration-200`}
            >
              {/* Big faded icon as backdrop texture, not a literal photo —
                  gives the card presence without needing a real image. */}
              <span
                aria-hidden
                className="pointer-events-none absolute -right-3 -bottom-4 text-[92px] sm:text-[112px] opacity-15 rotate-[-8deg] group-hover:scale-110 group-hover:opacity-20 transition-transform duration-300"
              >
                {style.icon}
              </span>
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/10" />
              <div className="absolute inset-x-0 bottom-0 p-2.5 sm:p-3.5 text-white">
                <p className="font-display font-bold text-xs sm:text-base leading-tight line-clamp-2 drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)]">
                  {card.title}
                </p>
                {card.subtitle && (
                  <p className="text-[11px] sm:text-sm font-bold text-gold mt-0.5">
                    {card.subtitle}
                  </p>
                )}
              </div>
              <span className="absolute right-2.5 bottom-2.5 sm:right-3.5 sm:bottom-3.5 h-6 w-6 sm:h-7 sm:w-7 rounded-full bg-white/15 backdrop-blur-sm grid place-items-center text-white text-xs group-hover:bg-white/25 transition-colors">
                →
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
