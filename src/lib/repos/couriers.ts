import { getDb } from "@/lib/db";
import type { Courier, CourierPublic } from "@/lib/types";

function toPublic(c: Courier): CourierPublic {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- destructured only to strip it from the returned object
  const { password_hash, ...rest } = c;
  return rest;
}

export async function listCouriers(activeOnly = false): Promise<CourierPublic[]> {
  const db = await getDb();
  const sql = activeOnly
    ? "SELECT * FROM couriers WHERE active = 1 ORDER BY name ASC"
    : "SELECT * FROM couriers ORDER BY name ASC";
  const rows = (await db.prepare(sql).all()) as unknown as Courier[];
  return rows.map(toPublic);
}

export async function getCourier(id: number): Promise<Courier | undefined> {
  const db = await getDb();
  return db.prepare("SELECT * FROM couriers WHERE id = ?").get(id) as Promise<
    Courier | undefined
  >;
}

export async function getCourierByPhone(phone: string): Promise<Courier | undefined> {
  const db = await getDb();
  return db.prepare("SELECT * FROM couriers WHERE phone = ?").get(phone.trim()) as Promise<
    Courier | undefined
  >;
}

export async function createCourier(data: {
  name: string;
  phone: string;
  password_hash: string;
}) {
  const db = await getDb();
  const info = await db
    .prepare(
      "INSERT INTO couriers (name, phone, password_hash) VALUES (@name, @phone, @password_hash)"
    )
    .run(data);
  return info.lastInsertRowid as number;
}

export async function updateCourier(
  id: number,
  data: Partial<{ name: string; phone: string; password_hash: string; active: boolean }>
) {
  const db = await getDb();
  const payload: Record<string, unknown> = { ...data, id };
  if ("active" in data) payload.active = data.active ? 1 : 0;
  const fields = Object.keys(data);
  if (fields.length === 0) return;
  const setClause = fields.map((f) => `${f} = @${f}`).join(", ");
  await db.prepare(`UPDATE couriers SET ${setClause} WHERE id = @id`).run(payload);
}

export async function deleteCourier(id: number) {
  const db = await getDb();
  await db.prepare("DELETE FROM couriers WHERE id = ?").run(id);
}

export async function updateCourierLocation(id: number, lat: number, lng: number) {
  const db = await getDb();
  await db
    .prepare(
      `UPDATE couriers SET last_lat = @lat, last_lng = @lng,
         last_location_at = to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')
       WHERE id = @id`
    )
    .run({ id, lat, lng });
}

export async function listActiveCourierLocations(): Promise<CourierPublic[]> {
  const db = await getDb();
  const rows = (await db
    .prepare(
      `SELECT * FROM couriers WHERE active = 1 AND last_location_at IS NOT NULL
         AND last_location_at >= to_char((now() - interval '15 minutes') at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')
       ORDER BY name ASC`
    )
    .all()) as unknown as Courier[];
  return rows.map(toPublic);
}
