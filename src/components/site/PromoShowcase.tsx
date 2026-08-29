import Link from "next/link";
import { promoCardStyle } from "@/lib/promo-card-style";
import { AddComboButton } from "@/components/site/AddComboButton";
import type { PromoCard } from "@/lib/types";

// Small cart-icon badge for a full-banner card that adds straight to the
// cart — a corner badge rather than a text bar, so it signals the action
// without covering much of the banner artwork underneath it.
function CartBadge({ size = "h-9 w-9" }: { size?: string }) {
  return (
    <span
      className={`absolute bottom-2 right-2 ${size} rounded-full bg-brand text-white grid place-items-center shadow-[0_4px_10px_rgba(0,0,0,0.5)]`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
        <circle cx="9" cy="21" r="1" />
        <circle cx="20" cy="21" r="1" />
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
      </svg>
    </span>
  );
}

// The homepage's 4 fixed "showcase" slots — active ones only (see
// listActivePromoCards). Two entirely different layouts by breakpoint
// rather than one responsive card: on phone, a horizontally-scrollable
// strip of compact dark cards (sized like a menu product card — photo on
// top, title/description/price below); on desktop, a wide 3-across grid of
// banner cards (colored background, eyebrow badge, big price, text CTA).
// A plain card links through to /oferti (the one page listing every active
// card with its fuller description); a card built from the combo picker
// (see PromoCardsManager) instead adds its linked product straight to the
// cart — no click-through needed, since there's nothing more to read.
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
          const orderable = Boolean(card.linked_product_id);

          // Full-banner cards: the image is a finished ad with its own
          // title/price already baked in, so it's the whole card — no text
          // pasted on top, and never cropped (object-contain), wider than
          // the regular card so it stays legible instead of squeezed into a
          // small square.
          if (card.full_banner && card.image) {
            const content = (
              <div className="relative aspect-[3/2]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={card.image}
                  alt={card.title}
                  className="absolute inset-0 h-full w-full object-contain"
                />
                {/* The banner has no CTA of its own baked in, so tapping it
                    silently adding to the cart would give no warning that's
                    what's about to happen — this badge is the only signal. */}
                {orderable && <CartBadge />}
              </div>
            );
            const className =
              "shrink-0 w-56 snap-start rounded-2xl bg-black overflow-hidden shadow-[0_8px_20px_-8px_rgba(0,0,0,0.5)]";
            return orderable ? (
              <AddComboButton
                key={card.id}
                productId={card.linked_product_id!}
                name={card.title}
                image={card.image}
                price={card.linked_product_price ?? 0}
                className={className}
              >
                {content}
              </AddComboButton>
            ) : (
              <Link key={card.id} href="/oferti" className={className}>
                {content}
              </Link>
            );
          }

          const content = (
            <>
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
            </>
          );
          const className =
            "shrink-0 w-36 snap-start text-left rounded-2xl bg-[#161414] border border-white/5 overflow-hidden shadow-[0_8px_20px_-8px_rgba(0,0,0,0.5)]";
          return orderable ? (
            <AddComboButton
              key={card.id}
              productId={card.linked_product_id!}
              name={card.title}
              image={card.image}
              price={card.linked_product_price ?? 0}
              className={className}
            >
              {content}
            </AddComboButton>
          ) : (
            <Link key={card.id} href="/oferti" className={className}>
              {content}
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
          const orderable = Boolean(card.linked_product_id);

          // Full-banner cards here too: just the finished ad image,
          // untouched and never cropped, on a black ground so no colored
          // letterboxing shows through — no badge/title/subtitle/CTA on top.
          if (card.full_banner && card.image) {
            const content = (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={card.image}
                  alt={card.title}
                  className="absolute inset-0 h-full w-full object-contain"
                />
                {/* The banner has no CTA of its own baked in, so clicking it
                    silently adding to the cart would give no warning that's
                    what's about to happen — this badge is the only signal. */}
                {orderable && <CartBadge size="h-10 w-10" />}
              </>
            );
            const className =
              "group relative rounded-2xl overflow-hidden bg-black min-h-[168px] w-full text-left hover:-translate-y-1 hover:shadow-[0_16px_32px_-10px_rgba(20,10,8,0.5)] shadow-[0_10px_24px_-10px_rgba(20,10,8,0.35)] transition-all duration-200";
            return orderable ? (
              <AddComboButton
                key={card.id}
                productId={card.linked_product_id!}
                name={card.title}
                image={card.image}
                price={card.linked_product_price ?? 0}
                className={className}
              >
                {content}
              </AddComboButton>
            ) : (
              <Link key={card.id} href="/oferti" className={className}>
                {content}
              </Link>
            );
          }

          const content = (
            <>
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
                  {orderable ? "Добави в количката" : "Поръчай сега →"}
                </span>
              </div>
            </>
          );
          const className = `group relative rounded-2xl overflow-hidden p-5 min-h-[168px] w-full text-left flex flex-col justify-between bg-gradient-to-br ${style.gradient} hover:-translate-y-1 hover:shadow-[0_16px_32px_-10px_rgba(20,10,8,0.5)] shadow-[0_10px_24px_-10px_rgba(20,10,8,0.35)] transition-all duration-200`;
          return orderable ? (
            <AddComboButton
              key={card.id}
              productId={card.linked_product_id!}
              name={card.title}
              image={card.image}
              price={card.linked_product_price ?? 0}
              className={className}
            >
              {content}
            </AddComboButton>
          ) : (
            <Link key={card.id} href="/oferti" className={className}>
              {content}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
