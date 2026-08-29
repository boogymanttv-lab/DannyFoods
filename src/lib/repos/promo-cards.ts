import { getDb } from "@/lib/db";
import type { PromoCard } from "@/lib/types";

// All 4 slots always exist (seeded once in runMigrations) — this just
// returns them in position order, active or not, for the admin panel.
export async function listPromoCards(): Promise<PromoCard[]> {
  const db = await getDb();
  return db
    .prepare("SELECT * FROM promo_cards ORDER BY position")
    .all() as Promise<PromoCard[]>;
}

// Homepage-facing — only the ones an admin has actually turned on, so a
// slot left blank/unconfigured never shows an empty card.
export async function listActivePromoCards(): Promise<PromoCard[]> {
  const db = await getDb();
  return db
    .prepare("SELECT * FROM promo_cards WHERE active = 1 ORDER BY position")
    .all() as Promise<PromoCard[]>;
}

export async function updatePromoCard(
  position: number,
  data: { active: boolean; title: string; subtitle: string; description: string; image: string }
): Promise<void> {
  const db = await getDb();
  await db
    .prepare(
      `UPDATE promo_cards
       SET active = @active, title = @title, subtitle = @subtitle,
           description = @description, image = @image
       WHERE position = @position`
    )
    .run({
      position,
      active: data.active ? 1 : 0,
      title: data.title,
      subtitle: data.subtitle,
      description: data.description,
      image: data.image,
    });
}
