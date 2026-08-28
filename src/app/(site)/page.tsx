import { listCategories } from "@/lib/repos/categories";
import { listProducts } from "@/lib/repos/products";
import { getSettings } from "@/lib/repos/settings";
import { MenuBrowser } from "@/components/site/MenuBrowser";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const categories = await listCategories();
  const products = await listProducts();
  const settings = await getSettings();

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
      <section className="relative overflow-hidden bg-accent-dark text-white">
        <div className="absolute inset-0 bg-gradient-to-br from-brand/40 via-transparent to-transparent" />
        <div className="relative mx-auto max-w-6xl px-4 py-14 sm:py-20">
          <span className="inline-block bg-gold text-accent-dark text-xs font-bold px-3 py-1.5 rounded-full mb-4">
            Доставка само в град Варна 🚴
          </span>
          <h1 className="font-display font-extrabold text-3xl sm:text-5xl leading-tight max-w-xl">
            {settings.tagline}
          </h1>
          <p className="mt-4 text-white/70 max-w-md">
            Поръчай онлайн и получи прясно приготвена храна директно на адреса си
            във Варна.
          </p>
          <a
            href="#menu"
            className="inline-block mt-6 bg-brand hover:bg-brand-light transition-colors font-bold px-6 py-3.5 rounded-xl"
          >
            Разгледай менюто
          </a>
        </div>
      </section>

      <MenuBrowser
        categories={categories}
        products={products}
        suggestedCategoryId={settings.suggested_category_id}
      />
    </div>
  );
}
