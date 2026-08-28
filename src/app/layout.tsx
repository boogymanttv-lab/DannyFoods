import type { Metadata } from "next";
import "./globals.css";
import { CartProvider } from "@/lib/cart-context";
import { getSettings } from "@/lib/repos/settings";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  const title = `${settings.site_name} — Доставка на храна във Варна`;
  const description = settings.tagline;
  const domain = settings.site_domain;
  const base = domain ? new URL(`https://${domain}`) : undefined;

  return {
    ...(base && { metadataBase: base }),
    title: {
      default: title,
      // Individual pages set their own <title> without repeating the brand
      // name — this appends " — <site_name>" automatically so every page's
      // tab title still reads as a full, distinct, SEO-friendly title.
      template: `%s — ${settings.site_name}`,
    },
    description,
    openGraph: {
      title,
      description,
      siteName: settings.site_name,
      locale: "bg_BG",
      type: "website",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
    robots: { index: true, follow: true },
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bg" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* This is the App Router root layout (applied site-wide, not a single page), so next/next/no-page-custom-font doesn't apply here. */}
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
