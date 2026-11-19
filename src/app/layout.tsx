import type { Metadata } from "next";
import "./globals.css";
import { CartProvider } from "@/lib/cart-context";
import { getSettings } from "@/lib/repos/settings";
import { getLocale } from "@/lib/i18n/locale";
import { translate } from "@/lib/i18n/dict";
import { translateOne } from "@/lib/i18n/auto";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  const locale = await getLocale();
  const title = `${settings.site_name} — ${translate(locale, "meta.titleSuffix")}`;
  const description = await translateOne(settings.tagline, locale);
  const domain = settings.site_domain;
  const base = domain ? new URL(`https://${domain}`) : undefined;
  const logo = settings.logo_url;

  return {
    ...(base && { metadataBase: base }),
    title: {
      default: title,
      template: `%s — ${settings.site_name}`,
    },
    description,
    alternates: { canonical: "./" },
    ...(logo && { icons: { icon: logo, shortcut: logo, apple: logo } }),
    openGraph: {
      title,
      description,
      siteName: settings.site_name,
      locale: locale === "en" ? "en_GB" : "bg_BG",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    robots: { index: true, follow: true },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale} className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Rubik:wght@500;700;800;900&family=Nunito:wght@400;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}
