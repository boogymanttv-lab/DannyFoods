import { getDb } from "@/lib/db";
import type { ProductReviewPublic } from "@/lib/types";

const NOW_UTC = `to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')`;

export async function listReviewsForProduct(productId: number): Promise<ProductReviewPublic[]> {
  const db = await getDb();
  return db
    .prepare(
      `SELECT r.*, c.name AS customer_name
       FROM product_reviews r
       JOIN customers c ON c.id = r.customer_id
       WHERE r.product_id = ?
       ORDER BY r.created_at DESC`
    )
    .all(productId) as Promise<ProductReviewPublic[]>;
}

export async function getRatingSummary(
  productId: number
): Promise<{ average: number; count: number }> {
  const db = await getDb();
  const row = (await db
    .prepare(
      `SELECT AVG(rating)::float AS average, COUNT(*)::int AS count FROM product_reviews WHERE product_id = ?`
    )
    .get(productId)) as { average: number | null; count: number };
  return { average: row?.average ?? 0, count: row?.count ?? 0 };
}

// Summaries for every product in one query — used by the menu grid so
// showing a star rating per card doesn't mean one query per card.
export async function getRatingSummaries(): Promise<
  Record<number, { average: number; count: number }>
> {
  const db = await getDb();
  const rows = (await db
    .prepare(
      `SELECT product_id, AVG(rating)::float AS average, COUNT(*)::int AS count
       FROM product_reviews GROUP BY product_id`
    )
    .all()) as { product_id: number; average: number; count: number }[];
  const map: Record<number, { average: number; count: number }> = {};
  for (const row of rows) map[row.product_id] = { average: row.average, count: row.count };
  return map;
}

// A customer may review a product only if it actually appears in one of
// their own past orders — checked against the stored items_json rather
// than a separate "purchases" table, since that's already the source of
// truth for what was ordered.
export async function customerHasOrderedProduct(
  customerId: number,
  productId: number
): Promise<{ ordered: boolean; orderId: number | null }> {
  const db = await getDb();
  const rows = (await db
    .prepare(`SELECT id, items_json FROM orders WHERE customer_id = ? AND status != 'cancelled'`)
    .all(customerId)) as { id: number; items_json: string }[];
  for (const row of rows) {
    try {
      const items: { productId: number }[] = JSON.parse(row.items_json);
      if (items.some((i) => i.productId === productId)) {
        return { ordered: true, orderId: row.id };
      }
    } catch {
      // malformed items_json on some ancient row — skip it rather than fail
    }
  }
  return { ordered: false, orderId: null };
}

export async function getCustomerReview(customerId: number, productId: number) {
  const db = await getDb();
  return db
    .prepare(`SELECT * FROM product_reviews WHERE customer_id = ? AND product_id = ?`)
    .get(customerId, productId);
}

export async function upsertReview(data: {
  productId: number;
  customerId: number;
  orderId: number | null;
  rating: number;
  comment: string;
}): Promise<void> {
  const db = await getDb();
  await db
    .prepare(
      `INSERT INTO product_reviews (product_id, customer_id, order_id, rating, comment, updated_at)
       VALUES (@productId, @customerId, @orderId, @rating, @comment, ${NOW_UTC})
       ON CONFLICT (customer_id, product_id) DO UPDATE SET
         rating = excluded.rating,
         comment = excluded.comment,
         order_id = excluded.order_id,
         updated_at = ${NOW_UTC}`
    )
    .run({
      productId: data.productId,
      customerId: data.customerId,
      orderId: data.orderId,
      rating: data.rating,
      comment: data.comment,
    });
}
