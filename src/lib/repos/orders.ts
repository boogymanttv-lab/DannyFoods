import { getDb } from "@/lib/db";
import type { Order, OrderItem, OrderStatus, PaymentMethod } from "@/lib/types";

// Reusable SQL fragment for "now, as UTC text" — matches the format
// created_at/updated_at columns are stored in (see schema.ts), so plain
// text comparisons/ordering keep working the same way they did with
// SQLite's datetime('now').
const NOW_UTC = `to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')`;

function generateOrderNumber(): string {
  const now = new Date();
  const y = now.getFullYear().toString().slice(2);
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `DD-${y}${m}${d}-${rand}`;
}

export async function createOrder(data: {
  customer_name: string;
  phone: string;
  email?: string;
  zone_id: number | null;
  quarter?: string;
  order_type: "delivery" | "pickup";
  address: string;
  street?: string;
  house_number?: string;
  intercom?: string;
  address_notes?: string;
  items: OrderItem[];
  subtotal: number;
  delivery_fee: number;
  discount: number;
  total: number;
  promo_code?: string | null;
  payment_method: PaymentMethod;
  notes?: string;
  customer_id?: number | null;
  requested_time?: string | null;
}): Promise<Order> {
  const db = await getDb();
  const order_number = generateOrderNumber();
  const info = await db
    .prepare(
      `INSERT INTO orders
        (order_number, customer_name, phone, email, zone_id, quarter, order_type, address, street, house_number, intercom, address_notes, items_json, subtotal, delivery_fee, discount, total, promo_code, payment_method, notes, customer_id, requested_time)
       VALUES
        (@order_number, @customer_name, @phone, @email, @zone_id, @quarter, @order_type, @address, @street, @house_number, @intercom, @address_notes, @items_json, @subtotal, @delivery_fee, @discount, @total, @promo_code, @payment_method, @notes, @customer_id, @requested_time)`
    )
    .run({
      order_number,
      customer_name: data.customer_name,
      phone: data.phone,
      email: data.email ?? "",
      zone_id: data.zone_id,
      quarter: data.quarter ?? "",
      order_type: data.order_type,
      address: data.address,
      street: data.street ?? "",
      house_number: data.house_number ?? "",
      intercom: data.intercom ?? "",
      address_notes: data.address_notes ?? "",
      items_json: JSON.stringify(data.items),
      subtotal: data.subtotal,
      delivery_fee: data.delivery_fee,
      discount: data.discount,
      total: data.total,
      promo_code: data.promo_code ?? null,
      payment_method: data.payment_method,
      notes: data.notes ?? "",
      customer_id: data.customer_id ?? null,
      requested_time: data.requested_time ?? null,
    });
  return (await getOrder(info.lastInsertRowid as number))!;
}

export async function listOrdersForCustomer(customerId: number, limit = 50): Promise<Order[]> {
  const db = await getDb();
  return db
    .prepare(
      "SELECT * FROM orders WHERE customer_id = @customerId ORDER BY id DESC LIMIT @limit"
    )
    .all({ customerId, limit }) as Promise<Order[]>;
}

// Filled in shortly after order creation, once the delivery address has
// been geocoded (see src/lib/geocode.ts) — used to draw a destination pin
// and route line on the customer's live tracking map.
export async function updateOrderDestination(id: number, lat: number, lng: number) {
  const db = await getDb();
  await db.prepare("UPDATE orders SET dest_lat = @lat, dest_lng = @lng WHERE id = @id").run({
    id,
    lat,
    lng,
  });
}

// Set by the admin when confirming an order — a short human-readable range
// like "15-20" (minutes). Null clears it back to "not set yet". The
// timestamp is (re)stamped whenever a non-null estimate is set, since the
// customer's countdown ring counts down from "when this estimate was given",
// not from when the order was first placed.
export async function updateOrderEstimate(id: number, estimate: string | null) {
  const db = await getDb();
  await db
    .prepare(
      `UPDATE orders SET estimated_delivery = @estimate,
         estimated_delivery_set_at = CASE WHEN @estimate::text IS NULL THEN NULL ELSE ${NOW_UTC} END
       WHERE id = @id`
    )
    .run({ id, estimate });
}

// Toggled independently by whichever kitchen station's staff finished
// prepping their part (see AdminUser.station) — separate from the overall
// order status, which any staff can still move forward regardless.
export async function setStationReady(
  id: number,
  station: "pizza" | "other",
  ready: boolean
) {
  const db = await getDb();
  const column = station === "pizza" ? "station_pizza_ready" : "station_other_ready";
  await db.prepare(`UPDATE orders SET ${column} = ? WHERE id = ?`).run(ready ? 1 : 0, id);
}

export async function getOrder(id: number): Promise<Order | undefined> {
  const db = await getDb();
  return db.prepare("SELECT * FROM orders WHERE id = ?").get(id) as Promise<Order | undefined>;
}

export async function getOrderByNumber(orderNumber: string): Promise<Order | undefined> {
  const db = await getDb();
  return db.prepare("SELECT * FROM orders WHERE order_number = ?").get(orderNumber) as Promise<
    Order | undefined
  >;
}

// Delivered orders that (a) belong to a customer account with an email on
// file — a guest checkout has no account to check a review against, so
// it's out of scope by design — and (b) haven't had the reminder sent yet.
// No upper bound on how long ago it was delivered: whether the cron job
// this feeds runs every few minutes or, on a plan that only allows daily
// crons, once a day, everything still eventually gets exactly one email —
// review_reminder_sent_at is what prevents a duplicate, not the query
// window. Capped at 200/run as a sane batch-size safety net.
export async function listOrdersNeedingReviewReminder(
  minMinutesSinceDelivery: number
): Promise<Order[]> {
  const db = await getDb();
  return db
    .prepare(
      `SELECT * FROM orders
       WHERE status = 'delivered'
         AND customer_id IS NOT NULL
         AND email IS NOT NULL AND email != ''
         AND review_reminder_sent_at IS NULL
         AND delivered_at IS NOT NULL
         AND delivered_at <= to_char(now() at time zone 'utc' - make_interval(mins => @mins), 'YYYY-MM-DD HH24:MI:SS')
       ORDER BY delivered_at ASC
       LIMIT 200`
    )
    .all({ mins: minMinutesSinceDelivery }) as Promise<Order[]>;
}

export async function markReviewReminderSent(orderId: number) {
  const db = await getDb();
  await db
    .prepare(`UPDATE orders SET review_reminder_sent_at = ${NOW_UTC} WHERE id = @orderId`)
    .run({ orderId });
}

export async function listOrders(opts?: {
  status?: OrderStatus;
  limit?: number;
  // Inclusive "YYYY-MM-DD" bounds, compared against the date portion of
  // created_at (stored as UTC text "YYYY-MM-DD HH:MM:SS") — used for the
  // admin report export's date-range picker.
  dateFrom?: string;
  dateTo?: string;
}): Promise<Order[]> {
  const db = await getDb();
  const clauses: string[] = [];
  const params: Record<string, unknown> = {};
  if (opts?.status) {
    clauses.push("status = @status");
    params.status = opts.status;
  }
  if (opts?.dateFrom) {
    clauses.push("left(created_at, 10) >= @dateFrom");
    params.dateFrom = opts.dateFrom;
  }
  if (opts?.dateTo) {
    clauses.push("left(created_at, 10) <= @dateTo");
    params.dateTo = opts.dateTo;
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const limit = opts?.limit ? `LIMIT ${opts.limit}` : "";
  return db
    .prepare(`SELECT * FROM orders ${where} ORDER BY id DESC ${limit}`)
    .all(params) as Promise<Order[]>;
}

// Orders currently "in the pipeline" — placed but not yet delivered or
// cancelled. Used to auto-suggest a longer delivery-time estimate when the
// kitchen/couriers are busy, regardless of time of day.
export async function countActiveOrders(): Promise<number> {
  const db = await getDb();
  const row = (await db
    .prepare(
      "SELECT COUNT(*) as c FROM orders WHERE status IN ('new','confirmed','preparing','delivering')"
    )
    .get()) as { c: number };
  return Number(row.c);
}

export async function updateOrderStatus(id: number, status: OrderStatus) {
  const db = await getDb();
  await db
    .prepare(`UPDATE orders SET status = @status, updated_at = ${NOW_UTC} WHERE id = @id`)
    .run({ id, status });
}

// Orders ready to be picked up by a courier: prepared, unclaimed, and
// actually needing delivery — 'pickup' orders (customer collects in person)
// never need a courier, so they're excluded here rather than showing up as
// unclaimable clutter in the courier queue.
export async function listAvailableOrdersForCourier(): Promise<Order[]> {
  const db = await getDb();
  return db
    .prepare(
      `SELECT * FROM orders WHERE courier_id IS NULL AND status IN ('confirmed','preparing') AND order_type = 'delivery' ORDER BY id ASC`
    )
    .all() as Promise<Order[]>;
}

export async function listOrdersForCourier(courierId: number): Promise<Order[]> {
  const db = await getDb();
  return db
    .prepare(
      `SELECT * FROM orders WHERE courier_id = @courierId AND status NOT IN ('delivered','cancelled') ORDER BY id ASC`
    )
    .all({ courierId }) as Promise<Order[]>;
}

export async function listDeliveredOrdersForCourier(
  courierId: number,
  limit = 20
): Promise<Order[]> {
  const db = await getDb();
  return db
    .prepare(
      `SELECT * FROM orders WHERE courier_id = @courierId AND status = 'delivered' ORDER BY id DESC LIMIT @limit`
    )
    .all({ courierId, limit }) as Promise<Order[]>;
}

// Atomic claim: only succeeds if the order is still unclaimed, so two
// couriers tapping "claim" on the same order at the same moment can't both win.
export async function claimOrder(orderId: number, courierId: number): Promise<boolean> {
  const db = await getDb();
  const info = await db
    .prepare(
      `UPDATE orders SET courier_id = @courierId, claimed_at = ${NOW_UTC}, updated_at = ${NOW_UTC}
       WHERE id = @orderId AND courier_id IS NULL`
    )
    .run({ orderId, courierId });
  return Number(info.changes) > 0;
}

export async function releaseOrder(orderId: number, courierId: number): Promise<boolean> {
  const db = await getDb();
  const info = await db
    .prepare(
      `UPDATE orders SET courier_id = NULL, claimed_at = NULL, updated_at = ${NOW_UTC}
       WHERE id = @orderId AND courier_id = @courierId`
    )
    .run({ orderId, courierId });
  return Number(info.changes) > 0;
}

// Couriers can only move their own orders through delivering -> delivered.
export async function updateOrderStatusByCourier(
  orderId: number,
  courierId: number,
  status: "delivering" | "delivered"
): Promise<boolean> {
  const db = await getDb();
  const deliveredAt = status === "delivered" ? `, delivered_at = ${NOW_UTC}` : "";
  const info = await db
    .prepare(
      `UPDATE orders SET status = @status, updated_at = ${NOW_UTC}${deliveredAt}
       WHERE id = @orderId AND courier_id = @courierId`
    )
    .run({ orderId, courierId, status });
  return Number(info.changes) > 0;
}

export async function assignCourierByAdmin(orderId: number, courierId: number | null) {
  const db = await getDb();
  await db
    .prepare(
      `UPDATE orders SET courier_id = @courierId, claimed_at = CASE WHEN @courierId::int IS NULL THEN NULL ELSE ${NOW_UTC} END, updated_at = ${NOW_UTC}
       WHERE id = @orderId`
    )
    .run({ orderId, courierId });
}

export async function updateOrderPayment(
  id: number,
  data: {
    payment_status?: "pending" | "paid" | "failed";
    stripe_session_id?: string;
    pizza_transfer_id?: string;
    pizza_transfer_amount?: number;
    pizza_transfer_status?: string;
    pizza_transfer_error?: string;
  }
) {
  const db = await getDb();
  const payload: Record<string, unknown> = { ...data, id };
  const fields = Object.keys(data);
  if (fields.length === 0) return;
  const setClause = fields.map((f) => `${f} = @${f}`).join(", ");
  await db
    .prepare(`UPDATE orders SET ${setClause}, updated_at = ${NOW_UTC} WHERE id = @id`)
    .run(payload);
}

export async function getOrderStats() {
  const db = await getDb();
  const today = new Date().toISOString().slice(0, 10);
  const todayOrders = (await db
    .prepare(
      "SELECT COUNT(*) as cnt, COALESCE(SUM(total),0) as revenue FROM orders WHERE left(created_at, 10) = ? AND status != 'cancelled'"
    )
    .get(today)) as { cnt: number; revenue: number };
  const totalOrders = (await db.prepare("SELECT COUNT(*) as cnt FROM orders").get()) as {
    cnt: number;
  };
  const activeOrders = (await db
    .prepare(
      "SELECT COUNT(*) as cnt FROM orders WHERE status IN ('new','confirmed','preparing','delivering')"
    )
    .get()) as { cnt: number };
  const topProducts = (await db
    .prepare(
      `SELECT items_json FROM orders WHERE status != 'cancelled' ORDER BY id DESC LIMIT 200`
    )
    .all()) as { items_json: string }[];
  const productCounts = new Map<string, number>();
  for (const row of topProducts) {
    try {
      const items: OrderItem[] = JSON.parse(row.items_json);
      for (const item of items) {
        productCounts.set(item.name, (productCounts.get(item.name) ?? 0) + item.quantity);
      }
    } catch {
      // ignore malformed rows
    }
  }
  const top = Array.from(productCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, qty]) => ({ name, qty }));

  return {
    todayOrders: Number(todayOrders.cnt),
    todayRevenue: Number(todayOrders.revenue),
    totalOrders: Number(totalOrders.cnt),
    activeOrders: Number(activeOrders.cnt),
    topProducts: top,
  };
}

// One row per calendar day for the last `days` days (oldest first, always
// including today even if it has no orders yet) — powers the admin
// dashboard's sales chart. Grouped by the UTC calendar day stored in
// created_at; cancelled orders don't count toward revenue or the order
// count, same convention as getOrderStats' "today" figures above.
export async function getDailySales(
  days: number
): Promise<{ date: string; orders: number; revenue: number }[]> {
  const db = await getDb();
  // created_at is stored as TEXT ("YYYY-MM-DD HH24:MI:SS", see schema.ts),
  // not a real timestamp column, so the cutoff is computed as the same
  // "YYYY-MM-DD" text form and compared lexicographically — that sorts
  // identically to chronological order for this fixed-width format.
  const cutoffDate = new Date();
  cutoffDate.setUTCDate(cutoffDate.getUTCDate() - (days - 1));
  const cutoff = cutoffDate.toISOString().slice(0, 10);
  const rows = (await db
    .prepare(
      `SELECT left(created_at, 10) as day, COUNT(*) as cnt, COALESCE(SUM(total),0) as revenue
       FROM orders
       WHERE status != 'cancelled' AND left(created_at, 10) >= @cutoff
       GROUP BY day
       ORDER BY day ASC`
    )
    .all({ cutoff })) as { day: string; cnt: number; revenue: number }[];
  const byDay = new Map(rows.map((r) => [r.day, { orders: Number(r.cnt), revenue: Number(r.revenue) }]));

  // Fill in every day in the range, even ones with zero orders, so the
  // chart's x-axis is a continuous timeline rather than skipping gaps.
  const series: { date: string; orders: number; revenue: number }[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    const found = byDay.get(key);
    series.push({ date: key, orders: found?.orders ?? 0, revenue: found?.revenue ?? 0 });
  }
  return series;
}
