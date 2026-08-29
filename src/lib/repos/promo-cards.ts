import { getDb } from "@/lib/db";
import type { PromoCard } from "@/lib/types";

// A LEFT JOIN so a card with no linked_product_id still comes back (just
// with linked_product_price null) — used by both listing functions below.
const SELECT_WITH_LINKED_PRICE = `
  SELECT pc.*, p.base_price AS linked_product_price
  FROM promo_cards pc
  LEFT JOIN products p ON p.id = pc.linked_product_id
`;

// All 4 slots always exist (seeded once in runMigrations) — this just
// returns them in position order, active or not, for the admin panel.
export async function listPromoCards(): Promise<PromoCard[]> {
  const db = await getDb();
  return db
    .prepare(`${SELECT_WITH_LINKED_PRICE} ORDER BY pc.position`)
    .all() as Promise<PromoCard[]>;
}

// Homepage-facing — only the ones an admin has actually turned on, so a
// slot left blank/unconfigured never shows an empty card.
export async function listActivePromoCards(): Promise<PromoCard[]> {
  const db = await getDb();
  return db
    .prepare(`${SELECT_WITH_LINKED_PRICE} WHERE pc.active = 1 ORDER BY pc.position`)
    .all() as Promise<PromoCard[]>;
}

export async function getPromoCardByPosition(
  position: number
): Promise<PromoCard | undefined> {
  const db = await getDb();
  return db
    .prepare(`${SELECT_WITH_LINKED_PRICE} WHERE pc.position = ?`)
    .get(position) as Promise<PromoCard | undefined>;
}

export async function updatePromoCard(
  position: number,
  data: {
    active: boolean;
    badge: string;
    title: string;
    subtitle: string;
    description: string;
    image: string;
    fullBanner: boolean;
    linkedProductId: number | null;
  }
): Promise<void> {
  const db = await getDb();
  await db
    .prepare(
      `UPDATE promo_cards
       SET active = @active, badge = @badge, title = @title, subtitle = @subtitle,
           description = @description, image = @image, full_banner = @full_banner,
           linked_product_id = @linked_product_id
       WHERE position = @position`
    )
    .run({
      position,
      active: data.active ? 1 : 0,
      badge: data.badge,
      title: data.title,
      subtitle: data.subtitle,
      description: data.description,
      image: data.image,
      full_banner: data.fullBanner ? 1 : 0,
      linked_product_id: data.linkedProductId,
    });
}
