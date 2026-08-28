// Automatic payout split for pizza items paid by card, via Stripe Connect.
//
// When a customer pays with a card and the order contains pizza items, this
// module computes how much of that payment is attributable to the pizza
// items and transfers exactly that amount to a second, separately-owned
// Stripe connected account — while the rest of the payment (everything
// else, plus the full delivery fee) stays in the main Stripe account. The
// main account absorbs Stripe's own processing fee; the pizza account
// receives its full computed share.
//
// This only runs for `payment_method === "stripe"` orders, since cash and
// card-on-delivery payments never touch Stripe at all — there's no digital
// money movement to split for those.
import Stripe from "stripe";
import type { Order, OrderItem } from "@/lib/types";
import { getPizzaProductIds } from "@/lib/repos/products";
import { updateOrderPayment } from "@/lib/repos/orders";

// How much of `order`'s payment is attributable to pizza items, in the same
// currency units as order.total (euros, not cents) — proportionally net of
// any discount applied to the order (so a promo code's savings are shared
// fairly), but never including the delivery fee, which stays entirely with
// the main account. Returns 0 if the order has no pizza items.
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

  // Spread the order's discount proportionally across all items (including
  // pizza) rather than assuming it applies only to non-pizza items or only
  // to pizza items — neither business gets an unfair share of a promo code.
  const discountRatio =
    order.subtotal > 0 ? Math.min(1, Math.max(0, order.discount / order.subtotal)) : 0;

  const share = pizzaSubtotal * (1 - discountRatio);
  return Math.round(share * 100) / 100;
}

// Transfers `order`'s pizza share to the configured connected account and
// records the outcome on the order row. Safe to call more than once for the
// same order (e.g. a retried Stripe webhook): if a transfer id is already
// recorded, it does nothing. Uses an idempotency key derived from the order
// number so even a concurrent double-call can't create two Stripe transfers.
export async function transferPizzaShareIfNeeded(
  order: Order,
  settings: { stripe_secret_key: string; pizza_stripe_account_id: string }
): Promise<void> {
  if (order.payment_method !== "stripe") return;
  if (!settings.pizza_stripe_account_id) return;
  if (order.pizza_transfer_id) return; // already done

  const amount = await computePizzaShare(order);
  if (amount <= 0) {
    // No pizza items (or a fully-discounted order) — nothing to transfer,
    // but still mark it as "handled" so this isn't retried forever.
    await updateOrderPayment(order.id, { pizza_transfer_status: "not_applicable" });
    return;
  }

  const stripe = new Stripe(settings.stripe_secret_key);
  try {
    // source_transaction ties the transfer to this specific payment's
    // charge instead of the platform's general available balance — this
    // avoids "insufficient funds" errors before the original charge's
    // payout has cleared, and keeps Stripe's own reporting/reconciliation
    // for this order tidy.
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
