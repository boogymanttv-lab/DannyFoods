import { getDb } from "@/lib/db";

export type PushSubscriptionRow = {
  id: number;
  courier_id: number;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string;
  created_at: string;
  last_success_at: string | null;
};

const NOW_UTC = `to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')`;

export async function savePushSubscription(
  courierId: number,
  sub: { endpoint: string; p256dh: string; auth: string },
  userAgent: string
) {
  const db = await getDb();
  // The same phone re-subscribing (or another courier logging in on it)
  // just takes over the existing row instead of creating a duplicate.
  await db
    .prepare(
      `INSERT INTO push_subscriptions (courier_id, endpoint, p256dh, auth, user_agent)
       VALUES (@courierId, @endpoint, @p256dh, @auth, @userAgent)
       ON CONFLICT (endpoint) DO UPDATE SET
         courier_id = EXCLUDED.courier_id,
         p256dh = EXCLUDED.p256dh,
         auth = EXCLUDED.auth,
         user_agent = EXCLUDED.user_agent`
    )
    .run({ courierId, endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth, userAgent });
}

export async function deletePushSubscription(courierId: number, endpoint: string) {
  const db = await getDb();
  await db
    .prepare("DELETE FROM push_subscriptions WHERE courier_id = @courierId AND endpoint = @endpoint")
    .run({ courierId, endpoint });
}

export async function deletePushSubscriptionById(id: number) {
  const db = await getDb();
  await db.prepare("DELETE FROM push_subscriptions WHERE id = ?").run(id);
}

export async function markPushSuccess(id: number) {
  const db = await getDb();
  await db.prepare(`UPDATE push_subscriptions SET last_success_at = ${NOW_UTC} WHERE id = ?`).run(id);
}

export async function hasPushSubscription(courierId: number, endpoint: string): Promise<boolean> {
  const db = await getDb();
  const row = await db
    .prepare("SELECT id FROM push_subscriptions WHERE courier_id = @courierId AND endpoint = @endpoint")
    .get({ courierId, endpoint });
  return Boolean(row);
}

export async function listSubscriptionsForCourier(courierId: number): Promise<PushSubscriptionRow[]> {
  const db = await getDb();
  return (await db
    .prepare("SELECT * FROM push_subscriptions WHERE courier_id = ?")
    .all(courierId)) as unknown as PushSubscriptionRow[];
}

export async function listSubscriptionsForActiveCouriers(): Promise<PushSubscriptionRow[]> {
  const db = await getDb();
  return (await db
    .prepare(
      `SELECT ps.* FROM push_subscriptions ps
       JOIN couriers c ON c.id = ps.courier_id
       WHERE c.active = 1`
    )
    .all()) as unknown as PushSubscriptionRow[];
}

export async function countSubscriptionsByCourier(): Promise<Record<number, number>> {
  const db = await getDb();
  const rows = (await db
    .prepare("SELECT courier_id, COUNT(*) AS c FROM push_subscriptions GROUP BY courier_id")
    .all()) as { courier_id: number; c: number | string }[];
  const out: Record<number, number> = {};
  for (const r of rows) out[Number(r.courier_id)] = Number(r.c);
  return out;
}

// Atomically "claims" the right to send a notification for an order, so two
// requests arriving at the same moment (e.g. a double click) can't both send.
export async function claimOrderBroadcast(orderId: number): Promise<boolean> {
  const db = await getDb();
  const info = await db
    .prepare(
      `UPDATE orders SET push_broadcast_at = ${NOW_UTC}
       WHERE id = @orderId AND push_broadcast_at IS NULL AND courier_id IS NULL`
    )
    .run({ orderId });
  return Number(info.changes) > 0;
}

export async function claimOrderCourierPush(orderId: number, courierId: number): Promise<boolean> {
  const db = await getDb();
  const info = await db
    .prepare(
      `UPDATE orders SET push_courier_id = @courierId
       WHERE id = @orderId AND courier_id = @courierId
         AND (push_courier_id IS NULL OR push_courier_id <> @courierId)`
    )
    .run({ orderId, courierId });
  return Number(info.changes) > 0;
}
