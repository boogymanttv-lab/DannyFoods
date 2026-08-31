import Link from "next/link";
import { listActivePromoCards } from "@/lib/repos/promo-cards";
import { promoCardStyle } from "@/lib/promo-card-style";
import { AddComboButton } from "@/components/site/AddComboButton";
import { formatPrice } from "@/lib/format";
import { getLocale } from "@/lib/i18n/locale";
import { translate, type DictKey } from "@/lib/i18n/dict";
import { localizePromoCard } from "@/lib/i18n/content";

export const dynamic = "force-dynamic";

export const metadata = { title: "Оферти" };

// Everything the homepage's 4 showcase cards link through to — same cards,
// just with room for the fuller description instead of the homepage's
// title+subtitle-only teaser.
export default async function OffersPage() {
  const locale = await getLocale();
  const t = (key: DictKey) => translate(locale, key);
  const cardsRaw = await listActivePromoCards();
  const cards = cardsRaw.map((c) => localizePromoCard(c, locale));

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="font-display font-extrabold text-3xl mb-2">{t("offers.title")}</h1>
      <p className="text-foreground/80 mb-8">
        {t("offers.intro")}{" "}
        <Link href="/#menu" className="text-brand font-semibold">
          {t("offers.menu")}
        </Link>
        .
      </p>

      {cards.length === 0 ? (
        <p className="text-muted text-center py-16">{t("offers.empty")}</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-5">
          {cards.map((card) => {
            const style = promoCardStyle(card.position);

            // Full-banner cards: the image is a finished ad with its own
            // text already baked in — show just the picture, intact
            // (object-contain) on a black ground, no title/description
            // underneath.
            if (card.full_banner && card.image) {
              return (
                <div
                  key={card.id}
                  className="rounded-2xl border border-border bg-surface overflow-hidden shadow-sm"
                >
                  <div className="relative aspect-[16/10] bg-black overflow-hidden">
                    {/* Blurred, zoomed-in copy of the same image fills the
                        letterboxed sides object-contain leaves bare. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={card.image}
                      alt=""
                      aria-hidden
                      className="absolute inset-0 h-full w-full object-cover blur-2xl scale-125 opacity-80"
                    />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={card.image}
                      alt={card.title}
                      loading="lazy"
                      decoding="async"
                      className="absolute inset-0 z-10 h-full w-full object-contain"
                    />
                  </div>
                  {/* A padded footer below the (black) image, rather than
                      the button sitting flush against it — reads as a
                      clearly separate action, not part of the banner
                      artwork itself. */}
                  {card.linked_product_id && (
                    <div className="p-4">
                      <AddComboButton
                        productId={card.linked_product_id}
                        name={card.title}
                        image={card.image}
                        price={card.linked_product_price ?? 0}
                        className="w-full bg-brand text-white font-bold text-sm py-3 rounded-xl"
                      >
                        {t("offers.addToCart")} · {formatPrice(card.linked_product_price ?? 0)}
                      </AddComboButton>
                    </div>
                  )}
                </div>
              );
            }

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
                      loading="lazy"
                      decoding="async"
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
                  {card.linked_product_id && (
                    <AddComboButton
                      productId={card.linked_product_id}
                      name={card.title}
                      image={card.image}
                      price={card.linked_product_price ?? 0}
                      className="w-full mt-3 bg-brand text-white font-bold text-sm py-2.5 rounded-xl"
                    >
                      {t("offers.addToCart")}
                    </AddComboButton>
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
