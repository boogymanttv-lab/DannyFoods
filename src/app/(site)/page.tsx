import { listCategories } from "@/lib/repos/categories";
import { listProducts } from "@/lib/repos/products";
import { getSettings } from "@/lib/repos/settings";
import { getRatingSummaries } from "@/lib/repos/reviews";
import { MenuBrowser } from "@/components/site/MenuBrowser";
import { isShopOpenNow } from "@/lib/delivery-slots";
import { estimateLabel, parseBusyHours, suggestEstimate } from "@/lib/delivery-estimate";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const categories = await listCategories();
  const products = await listProducts();
  const settings = await getSettings();
  const ratings = await getRatingSummaries();

  const openNow = isShopOpenNow(new Date(), settings.opening_time, settings.closing_time);
  const currentEstimate = estimateLabel(
    suggestEstimate(parseBusyHours(settings.busy_hours_json))
  );

  // Structured data (schema.org Restaurant) — lets Google show rich local-
  // search results (opening hours, phone, price range) instead of just a
  // plain blue link. Kept minimal/accurate to what's actually configurable
  // in Настройки; no fields are guessed beyond what the admin has entered.
  const domain = settings.site_domain;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: settings.site_name,
    description: settings.tagline,
    telephone: settings.phone,
    ...(domain && { url: `https://${domain}` }),
    address: {
      "@type": "PostalAddress",
      streetAddress: settings.address,
      addressLocality: "Варна",
      addressCountry: "BG",
    },
    servesCuisine: ["Pizza", "Fast Food", "Bulgarian"],
    priceRange: "€€",
    openingHoursSpecification: {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ],
      opens: settings.opening_time,
      closes: settings.closing_time,
    },
  };

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <section className="relative overflow-hidden bg-gradient-to-b from-accent-dark to-[#120d0d] text-white">
        <div className="absolute inset-0 bg-gradient-to-br from-brand/40 via-transparent to-transparent" />
        {/* Soft drifting glow blobs for depth, matching the splash screen's
            premium backdrop treatment. */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-24 -left-16 h-80 w-80 rounded-full bg-brand/25 blur-3xl animate-blob" />
          <div
            className="absolute -bottom-28 -right-10 h-96 w-96 rounded-full bg-gold/20 blur-3xl animate-blob"
            style={{ animationDelay: "-4s" }}
          />
        </div>
        <div className="relative mx-auto max-w-6xl px-4 py-14 sm:py-20">
          <span className="inline-block bg-gradient-to-r from-gold to-[#ffc247] text-accent-dark text-xs font-bold px-3.5 py-1.5 rounded-full mb-4 shadow-[0_4px_16px_rgba(245,166,35,0.35)]">
            Доставка само в град Варна 🚴
          </span>
          <div className="mb-4">
            <span
              className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs sm:text-sm font-bold backdrop-blur-sm ${
                openNow
                  ? "border-gold/40 bg-gold/10 text-gold shadow-[0_0_18px_rgba(245,166,35,0.2)]"
                  : "border-white/20 bg-white/5 text-white/60"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${openNow ? "bg-gold shadow-[0_0_8px_rgba(245,166,35,0.9)]" : "bg-white/40"}`}
                aria-hidden
              />
              {openNow
                ? `ОТВОРЕНО · ДОСТАВЯМЕ ДО ${currentEstimate.toUpperCase()}`
                : "В МОМЕНТА СМЕ ЗАТВОРЕНИ"}
            </span>
          </div>
          <h1 className="font-display font-extrabold text-3xl sm:text-5xl leading-tight max-w-xl bg-gradient-to-br from-white via-white to-white/70 bg-clip-text text-transparent drop-shadow-[0_2px_12px_rgba(0,0,0,0.3)]">
            {settings.tagline}
          </h1>
          <p className="mt-4 text-white/70 max-w-md">
            Поръчай онлайн и получи прясно приготвена храна директно на адреса си
            във Варна.
          </p>
          <a
            href="#menu"
            className="inline-block mt-6 bg-gradient-to-r from-brand to-brand-dark hover:from-brand-light hover:to-brand transition-all font-bold px-6 py-3.5 rounded-xl shadow-[0_8px_24px_rgba(225,29,46,0.45)] hover:shadow-[0_10px_30px_rgba(225,29,46,0.6)] hover:-translate-y-0.5"
          >
            🔥 Разгледай менюто
          </a>
        </div>
      </section>

      <MenuBrowser
        categories={categories}
        products={products}
        suggestedCategoryId={settings.suggested_category_id}
        ratings={ratings}
      />
    </div>
  );
}
