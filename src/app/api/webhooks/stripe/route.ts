import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getSettings } from "@/lib/repos/settings";
import { getOrderByNumber, updateOrderPayment } from "@/lib/repos/orders";

export async function POST(req: NextRequest) {
  const settings = await getSettings();
  if (!settings.stripe_secret_key) {
    return NextResponse.json({ error: "Stripe не е конфигуриран" }, { status: 400 });
  }

  const body = await req.text();
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  const stripe = new Stripe(settings.stripe_secret_key);
  let event: Stripe.Event;

  try {
    if (webhookSecret && signature) {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } else {
      // No webhook secret configured (local/dev) — trust the payload as-is.
      event = JSON.parse(body);
    }
  } catch (err) {
    console.error("Webhook signature verification failed", err);
    return NextResponse.json({ error: "Невалиден webhook" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderNumber = session.metadata?.order_number;
    if (orderNumber) {
      const order = await getOrderByNumber(orderNumber);
      if (order) {
        await updateOrderPayment(order.id, { payment_status: "paid" });
      }
    }
  }

  return NextResponse.json({ received: true });
}
