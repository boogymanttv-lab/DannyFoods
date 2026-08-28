import type { MetadataRoute } from "next";
import { getSettings } from "@/lib/repos/settings";

// Only the public, indexable marketing/content pages — private pages
// (account, checkout, order confirmations, admin/courier panels) are kept
// out on purpose, matching robots.ts.
const PUBLIC_PATHS: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
  { path: "/", priority: 1, changeFrequency: "daily" },
  { path: "/contact", priority: 0.6, changeFrequency: "monthly" },
  { path: "/zones", priority: 0.6, changeFrequency: "monthly" },
  { path: "/allergens", priority: 0.5, changeFrequency: "monthly" },
  { path: "/careers", priority: 0.4, changeFrequency: "monthly" },
  { path: "/terms", priority: 0.3, changeFrequency: "yearly" },
  { path: "/privacy", priority: 0.3, changeFrequency: "yearly" },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const settings = await getSettings();
  const domain = settings.site_domain;
  // Without a configured domain we can't produce valid absolute URLs — an
  // empty sitemap is safer than one full of "https://undefined/..." links.
  if (!domain) return [];
  const base = `https://${domain}`;

  const now = new Date();
  return PUBLIC_PATHS.map(({ path, priority, changeFrequency }) => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  }));
}
