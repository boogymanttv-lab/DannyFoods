import Link from "next/link";
import { listActivePromoCards } from "@/lib/repos/promo-cards";
import { promoCardStyle } from "@/lib/promo-card-style";

export const dynamic = "force-dynamic";

export const metadata = { title: "Оферти" };

// Everything the homepage's 4 showcase cards link through to — same cards,
// just with room for the fuller description instead of the homepage's
// title+subtitle-only teaser.
export default async function OffersPage() {
  const cards = await listActivePromoCards();

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="font-display font-extrabold text-3xl mb-2">Оферти</h1>
      <p className="text-foreground/80 mb-8">
        Текущите ни промоции и комбо пакети — за постоянното меню виж{" "}
        <Link href="/#menu" className="text-brand font-semibold">
          менюто
        </Link>
        .
      </p>

      {cards.length === 0 ? (
        <p className="text-muted text-center py-16">
          В момента няма активни оферти — очаквайте скоро.
        </p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-5">
          {cards.map((card) => {
            const style = promoCardStyle(card.position);
            return (
              <div
                key={card.id}
                className="rounded-2xl border border-border bg-surface overflow-hidden shadow-sm"
              >
                <div
                  className={`relative aspect-[16/10] overflow-hidden bg-gradient-to-br ${style.gradient}`}
                >
                  {card.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={card.image}
                      alt={card.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span
                      aria-hidden
                      className="pointer-events-none absolute -right-4 -bottom-6 text-[130px] opacity-20 rotate-[-8deg]"
                    >
                      {style.icon}
                    </span>
                  )}
                </div>
                <div className="p-5">
                  {card.badge && (
                    <p className="text-brand-dark text-[11px] font-extrabold uppercase tracking-wider mb-1">
                      {card.badge}
                    </p>
                  )}
                  <h2 className="font-display font-bold text-lg">{card.title}</h2>
                  {card.subtitle && (
                    <p className="text-brand font-bold text-sm mt-0.5">{card.subtitle}</p>
                  )}
                  {card.description && (
                    <p className="text-muted text-sm mt-2">{card.description}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
