import Stripe from "stripe";
import type { Order, OrderItem } from "@/lib/types";
import { getPizzaProductIds } from "@/lib/repos/products";
import { updateOrderPayment } from "@/lib/repos/orders";

export async function computePizzaShare(order: Order): Promise<number> {
  let items: OrderItem[];
  try {
    items = JSON.parse(order.items_json) as OrderItem[];
  } catch {
    return 0;
  }
  if (items.length === 0) return 0;

  const productIds = [...new Set(items.map((i) => i.productId))];
  const pizzaIds = await getPizzaProductIds(productIds);
  if (pizzaIds.size === 0) return 0;

  const pizzaSubtotal = items
    .filter((i) => pizzaIds.has(i.productId))
    .reduce((sum, i) => sum + i.lineTotal, 0);
  if (pizzaSubtotal <= 0) return 0;

  const discountRatio =
    order.subtotal > 0 ? Math.min(1, Math.max(0, order.discount / order.subtotal)) : 0;

  const share = pizzaSubtotal * (1 - discountRatio);
  return Math.round(share * 100) / 100;
}

export async function transferPizzaShareIfNeeded(
  order: Order,
  settings: { stripe_secret_key: string; pizza_stripe_account_id: string }
): Promise<void> {
  if (order.payment_method !== "stripe") return;
  if (!settings.pizza_stripe_account_id) return;
  if (order.pizza_transfer_id) return;

  const amount = await computePizzaShare(order);
  if (amount <= 0) {
    await updateOrderPayment(order.id, { pizza_transfer_status: "not_applicable" });
    return;
  }

  const stripe = new Stripe(settings.stripe_secret_key);
  try {
    let sourceCharge: string | undefined;
    if (order.stripe_session_id) {
      const session = await stripe.checkout.sessions.retrieve(order.stripe_session_id, {
        expand: ["payment_intent"],
      });
      const pi = session.payment_intent;
      if (pi && typeof pi !== "string") {
        sourceCharge =
          typeof pi.latest_charge === "string" ? pi.latest_charge : pi.latest_charge?.id;
      }
    }

    const transfer = await stripe.transfers.create(
      {
        amount: Math.round(amount * 100),
        currency: "eur",
        destination: settings.pizza_stripe_account_id,
        ...(sourceCharge && { source_transaction: sourceCharge }),
        transfer_group: order.order_number,
        description: `Пица дял от поръчка ${order.order_number}`,
      },
      { idempotencyKey: `pizza-split-${order.order_number}` }
    );

    await updateOrderPayment(order.id, {
      pizza_transfer_id: transfer.id,
      pizza_transfer_amount: amount,
      pizza_transfer_status: "transferred",
    });
  } catch (err) {
    console.error(`Pizza split transfer failed for order ${order.order_number}`, err);
    await updateOrderPayment(order.id, {
      pizza_transfer_status: "failed",
      pizza_transfer_error: err instanceof Error ? err.message : String(err),
    });
  }
}
