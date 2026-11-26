import webpush from "web-push";
import { getOrder } from "@/lib/repos/orders";
import { getSettings } from "@/lib/repos/settings";
import { formatPrice } from "@/lib/format";
import {
  claimOrderBroadcast,
  claimOrderCourierPush,
  deletePushSubscriptionById,
  listSubscriptionsForActiveCouriers,
  listSubscriptionsForCourier,
  markPushSuccess,
  type PushSubscriptionRow,
} from "@/lib/repos/push";

export type PushPayload = {
  title: string;
  body: string;
  url: string;
  tag: string;
};

// Statuses meaning "the kitchen has accepted the order" — only from here on
// do couriers get notified, so nobody drives off for an order that may
// still be rejected.
const ACCEPTED_STATUSES = new Set(["confirmed", "preparing", "delivering"]);

let configured: boolean | null = null;

export function vapidPublicKey(): string {
  return process.env.VAPID_PUBLIC_KEY ?? "";
}

async function ensureConfigured(): Promise<boolean> {
  if (configured !== null) return configured;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) {
    configured = false;
    return false;
  }
  let subject = process.env.VAPID_SUBJECT ?? "";
  if (!subject) {
    const settings = await getSettings();
    subject = settings.site_domain ? `https://${settings.site_domain}` : "https://foodsdany.bg";
  }
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
  return true;
}

export async function sendToSubscriptions(
  subs: PushSubscriptionRow[],
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  if (subs.length === 0 || !(await ensureConfigured())) return { sent: 0, failed: 0 };
  const body = JSON.stringify(payload);
  let sent = 0;
  let failed = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body,
          { TTL: 15 * 60, urgency: "high", timeout: 8000 }
        );
        sent += 1;
        await markPushSuccess(s.id).catch(() => {});
      } catch (err) {
        failed += 1;
        const status = (err as { statusCode?: number }).statusCode;
        // 404/410 = the phone uninstalled the app, cleared site data or
        // revoked permission — this subscription will never work again.
        if (status === 404 || status === 410) {
          await deletePushSubscriptionById(s.id).catch(() => {});
        } else {
          console.error("Web push failed", status, err);
        }
      }
    })
  );
  return { sent, failed };
}

function describeOrder(order: { order_number: string; quarter?: string | null; address: string; total: number }) {
  const place = order.quarter?.trim() || order.address;
  return `${place} · ${formatPrice(order.total)}`;
}

// Called after anything that can make an order "ready for a courier":
// kitchen accepting it, the owner assigning/reassigning a courier, or a card
// payment going through. Safe to call any number of times — each
// notification is sent at most once per order (per assigned courier).
export async function notifyCouriersForOrder(orderId: number): Promise<void> {
  try {
    const order = await getOrder(orderId);
    if (!order) return;
    if (order.order_type !== "delivery") return;
    if (!ACCEPTED_STATUSES.has(order.status)) return;
    if (order.payment_method === "stripe" && order.payment_status !== "paid") return;

    if (order.courier_id) {
      if (!(await claimOrderCourierPush(order.id, order.courier_id))) return;
      const subs = await listSubscriptionsForCourier(order.courier_id);
      await sendToSubscriptions(subs, {
        title: `📦 Назначена ти е поръчка ${order.order_number}`,
        body: describeOrder(order),
        url: "/courier?tab=mine",
        tag: `order-${order.id}`,
      });
      return;
    }

    // Unassigned: everyone active gets it, first to tap "Вземи" takes it.
    // Only while it's still waiting (a courier is no longer needed once
    // it's on its way).
    if (order.status === "delivering") return;
    if (!(await claimOrderBroadcast(order.id))) return;
    const subs = await listSubscriptionsForActiveCouriers();
    await sendToSubscriptions(subs, {
      title: `🛵 Нова поръчка ${order.order_number}`,
      body: describeOrder(order),
      url: "/courier",
      tag: `order-${order.id}`,
    });
  } catch (err) {
    // A failed notification must never break saving the order itself.
    console.error("notifyCouriersForOrder failed", err);
  }
}
