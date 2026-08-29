import Link from "next/link";
import { promoCardStyle } from "@/lib/promo-card-style";
import type { PromoCard } from "@/lib/types";

// The homepage's 4 fixed "showcase" slots — active ones only (see
// listActivePromoCards). Two entirely different layouts by breakpoint
// rather than one responsive card: on phone, a horizontally-scrollable
// strip of compact dark cards (sized like a menu product card — photo on
// top, title/description/price below); on desktop, a wide 3-across grid of
// banner cards (colored background, eyebrow badge, big price, text CTA).
// Every card links to /oferti — the one page listing all active cards with
// their fuller description — rather than each having its own destination,
// since these are meant to read as one themed "offers" section.
export function PromoShowcase({ cards }: { cards: PromoCard[] }) {
  if (cards.length === 0) return null;

  return (
    <div className="pt-6 sm:pt-8">
      <div className="mx-auto max-w-6xl px-4 flex items-baseline justify-between mb-3">
        <h2 className="font-display font-extrabold text-lg sm:text-xl">Оферти на деня</h2>
        <Link href="/oferti" className="text-xs sm:text-sm font-bold text-brand">
          Всички →
        </Link>
      </div>

      {/* Phone: compact scroll-right strip */}
      <div className="sm:hidden flex gap-3 overflow-x-auto no-scrollbar snap-x snap-mandatory px-4 pb-1">
        {cards.map((card) => {
          const style = promoCardStyle(card.position);
          return (
            <Link
              key={card.id}
              href="/oferti"
              className="shrink-0 w-36 snap-start rounded-2xl bg-[#161414] border border-white/5 overflow-hidden shadow-[0_8px_20px_-8px_rgba(0,0,0,0.5)]"
            >
              <div className={`relative aspect-square bg-gradient-to-br ${style.gradient}`}>
                {card.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={card.image}
                    alt={card.title}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : (
                  <span aria-hidden className="absolute inset-0 grid place-items-center text-4xl">
                    {style.icon}
                  </span>
                )}
                {card.badge && (
                  <span className="absolute top-2 left-2 bg-brand text-white text-[9px] font-extrabold uppercase tracking-wide px-2 py-1 rounded-md">
                    {card.badge}
                  </span>
                )}
              </div>
              <div className="p-2.5 relative">
                <p className="font-display font-bold text-white text-xs leading-tight line-clamp-1">
                  {card.title}
                </p>
                {card.description && (
                  <p className="text-white/45 text-[10.5px] mt-0.5 line-clamp-1">{card.description}</p>
                )}
                <div className="flex items-end justify-between mt-1.5">
                  {card.subtitle && (
                    <p className="text-white font-bold text-sm">
                      {card.subtitle}
                    </p>
                  )}
                  <span className="h-7 w-7 shrink-0 rounded-full bg-brand text-white grid place-items-center text-sm font-bold shadow-[0_4px_10px_rgba(225,29,46,0.5)]">
                    +
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Desktop/tablet: wide banner grid — column count adapts to how many
          cards are actually active, so a lone 4th card never gets stranded
          alone on its own row. */}
      <div
        className={`hidden sm:grid mx-auto max-w-6xl px-4 gap-4 ${
          cards.length === 1
            ? "grid-cols-1"
            : cards.length === 2
              ? "grid-cols-2"
              : cards.length === 3
                ? "grid-cols-3"
                : "grid-cols-2 lg:grid-cols-4"
        }`}
      >
        {cards.map((card) => {
          const style = promoCardStyle(card.position);
          return (
            <Link
              key={card.id}
              href="/oferti"
              className={`group relative rounded-2xl overflow-hidden p-5 min-h-[168px] flex flex-col justify-between bg-gradient-to-br ${style.gradient} hover:-translate-y-1 hover:shadow-[0_16px_32px_-10px_rgba(20,10,8,0.5)] shadow-[0_10px_24px_-10px_rgba(20,10,8,0.35)] transition-all duration-200`}
            >
              {card.image ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={card.image}
                    alt=""
                    aria-hidden
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  {/* Scrim over the full photo so the title/price stay
                      readable regardless of what's in the picture. */}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/10" />
                </>
              ) : (
                <span
                  aria-hidden
                  className="pointer-events-none absolute -right-3 -bottom-4 text-[92px] opacity-15 rotate-[-8deg]"
                >
                  {style.icon}
                </span>
              )}

              <div className="relative">
                {card.badge && (
                  <p className="text-gold text-[11px] font-extrabold uppercase tracking-wider mb-1.5">
                    {card.badge}
                  </p>
                )}
                <h3 className="font-display font-extrabold text-white text-lg leading-tight max-w-[75%] drop-shadow-[0_1px_4px_rgba(0,0,0,0.5)]">
                  {card.title}
                </h3>
                {card.description && (
                  <p className="text-white/70 text-xs mt-1 line-clamp-1 max-w-[75%]">{card.description}</p>
                )}
              </div>
              <div className="relative">
                {card.subtitle && (
                  <p className="text-white font-extrabold text-xl mb-1 drop-shadow-[0_1px_4px_rgba(0,0,0,0.5)]">
                    {card.subtitle}
                  </p>
                )}
                <span className="text-white/85 text-sm font-bold underline underline-offset-2 decoration-white/40 group-hover:text-gold group-hover:decoration-gold transition-colors">
                  Поръчай сега →
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
