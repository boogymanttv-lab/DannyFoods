import { getDb } from "@/lib/db";
import type { DeliveryZone } from "@/lib/types";

export async function listZones(activeOnly = true): Promise<DeliveryZone[]> {
  const db = await getDb();
  const sql = activeOnly
    ? "SELECT * FROM delivery_zones WHERE active = 1 ORDER BY sort_order ASC, name ASC"
    : "SELECT * FROM delivery_zones ORDER BY sort_order ASC, name ASC";
  return db.prepare(sql).all() as Promise<DeliveryZone[]>;
}

export async function getZone(id: number): Promise<DeliveryZone | undefined> {
  const db = await getDb();
  return db.prepare("SELECT * FROM delivery_zones WHERE id = ?").get(id) as Promise<
    DeliveryZone | undefined
  >;
}

export async function createZone(data: {
  name: string;
  delivery_fee: number;
  min_order: number;
  sort_order?: number;
}) {
  const db = await getDb();
  const info = await db
    .prepare(
      `INSERT INTO delivery_zones (name, delivery_fee, min_order, sort_order)
       VALUES (@name, @delivery_fee, @min_order, @sort_order)`
    )
    .run({ ...data, sort_order: data.sort_order ?? 0 });
  return info.lastInsertRowid as number;
}

export async function updateZone(
  id: number,
  data: Partial<{
    name: string;
    delivery_fee: number;
    min_order: number;
    active: boolean;
    sort_order: number;
  }>
) {
  const db = await getDb();
  const payload: Record<string, unknown> = { ...data, id };
  if ("active" in data) payload.active = data.active ? 1 : 0;
  const fields = Object.keys(data);
  if (fields.length === 0) return;
  const setClause = fields.map((f) => `${f} = @${f}`).join(", ");
  await db.prepare(`UPDATE delivery_zones SET ${setClause} WHERE id = @id`).run(payload);
}

export async function deleteZone(id: number) {
  const db = await getDb();
  await db.prepare("DELETE FROM delivery_zones WHERE id = ?").run(id);
}
