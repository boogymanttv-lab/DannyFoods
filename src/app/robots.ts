import type { MetadataRoute } from "next";
import { getSettings } from "@/lib/repos/settings";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const settings = await getSettings();
  const domain = settings.site_domain;
  const base = domain ? `https://${domain}` : undefined;

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/courier",
        "/account",
        "/checkout",
        // Order confirmation/tracking pages carry a customer's name, phone
        // and address — must never be indexed or shown in search results.
        "/order",
        "/api",
      ],
    },
    ...(base && { sitemap: `${base}/sitemap.xml` }),
  };
}
