import { getDb } from "@/lib/db";
import type { Promotion } from "@/lib/types";

export async function listPromotions(): Promise<Promotion[]> {
  const db = await getDb();
  return db.prepare("SELECT * FROM promotions ORDER BY id DESC").all() as Promise<Promotion[]>;
}

export async function getPromotionByCode(code: string): Promise<Promotion | undefined> {
  const db = await getDb();
  return db
    .prepare("SELECT * FROM promotions WHERE LOWER(code) = LOWER(?)")
    .get(code.trim()) as Promise<Promotion | undefined>;
}

export async function createPromotion(data: {
  code: string;
  description?: string;
  discount_type: "percent" | "fixed";
  discount_value: number;
  min_order?: number;
  starts_at?: string | null;
  ends_at?: string | null;
  usage_limit?: number | null;
}) {
  const db = await getDb();
  const info = await db
    .prepare(
      `INSERT INTO promotions (code, description, discount_type, discount_value, min_order, starts_at, ends_at, usage_limit)
       VALUES (@code, @description, @discount_type, @discount_value, @min_order, @starts_at, @ends_at, @usage_limit)`
    )
    .run({
      code: data.code.trim().toUpperCase(),
      description: data.description ?? "",
      discount_type: data.discount_type,
      discount_value: data.discount_value,
      min_order: data.min_order ?? 0,
      starts_at: data.starts_at ?? null,
      ends_at: data.ends_at ?? null,
      usage_limit: data.usage_limit ?? null,
    });
  return info.lastInsertRowid as number;
}

export async function updatePromotion(
  id: number,
  data: Partial<{
    code: string;
    description: string;
    discount_type: "percent" | "fixed";
    discount_value: number;
    min_order: number;
    starts_at: string | null;
    ends_at: string | null;
    usage_limit: number | null;
    active: boolean;
  }>
) {
  const db = await getDb();
  const payload: Record<string, unknown> = { ...data, id };
  if ("active" in data) payload.active = data.active ? 1 : 0;
  if ("code" in data && data.code) payload.code = data.code.trim().toUpperCase();
  const fields = Object.keys(data);
  if (fields.length === 0) return;
  const setClause = fields.map((f) => `${f} = @${f}`).join(", ");
  await db.prepare(`UPDATE promotions SET ${setClause} WHERE id = @id`).run(payload);
}

export async function deletePromotion(id: number) {
  const db = await getDb();
  await db.prepare("DELETE FROM promotions WHERE id = ?").run(id);
}

export async function incrementPromotionUsage(id: number) {
  const db = await getDb();
  await db.prepare("UPDATE promotions SET used_count = used_count + 1 WHERE id = ?").run(id);
}

export async function validatePromotion(
  code: string,
  subtotal: number
): Promise<
  { ok: true; promotion: Promotion; discount: number } | { ok: false; error: string }
> {
  const promo = await getPromotionByCode(code);
  if (!promo) return { ok: false, error: "Невалиден промо код" };
  if (!promo.active) return { ok: false, error: "Този промо код вече не е активен" };
  const now = new Date();
  if (promo.starts_at && new Date(promo.starts_at) > now)
    return { ok: false, error: "Този промо код все още не е активен" };
  if (promo.ends_at && new Date(promo.ends_at) < now)
    return { ok: false, error: "Този промо код е изтекъл" };
  if (promo.usage_limit != null && promo.used_count >= promo.usage_limit)
    return { ok: false, error: "Този промо код е изчерпан" };
  if (subtotal < promo.min_order)
    return {
      ok: false,
      error: `Минимална поръчка за този код: ${promo.min_order.toFixed(2)} €`,
    };
  const discount =
    promo.discount_type === "percent"
      ? (subtotal * promo.discount_value) / 100
      : Math.min(promo.discount_value, subtotal);
  return { ok: true, promotion: promo, discount: Math.round(discount * 100) / 100 };
}
