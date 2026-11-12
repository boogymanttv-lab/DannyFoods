import { getDb } from "@/lib/db";
import type { PromoCard } from "@/lib/types";

const SELECT_WITH_LINKED_PRICE = `
  SELECT pc.*, p.base_price AS linked_product_price
  FROM promo_cards pc
  LEFT JOIN products p ON p.id = pc.linked_product_id
`;

export async function listPromoCards(): Promise<PromoCard[]> {
  const db = await getDb();
  return db
    .prepare(`${SELECT_WITH_LINKED_PRICE} ORDER BY pc.position`)
    .all() as Promise<PromoCard[]>;
}

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
    title_en?: string;
    subtitle: string;
    description: string;
    description_en?: string;
    image: string;
    fullBanner: boolean;
    linkedProductId: number | null;
  }
): Promise<void> {
  const db = await getDb();
  await db
    .prepare(
      `UPDATE promo_cards
       SET active = @active, badge = @badge, title = @title, title_en = @title_en,
           subtitle = @subtitle, description = @description, description_en = @description_en,
           image = @image, full_banner = @full_banner,
           linked_product_id = @linked_product_id
       WHERE position = @position`
    )
    .run({
      position,
      active: data.active ? 1 : 0,
      badge: data.badge,
      title: data.title,
      title_en: data.title_en ?? "",
      subtitle: data.subtitle,
      description: data.description,
      description_en: data.description_en ?? "",
      image: data.image,
      full_banner: data.fullBanner ? 1 : 0,
      linked_product_id: data.linkedProductId,
    });
}
