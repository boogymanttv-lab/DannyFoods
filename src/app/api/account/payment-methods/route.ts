import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getCustomerSession } from "@/lib/auth";
import { getCustomer } from "@/lib/repos/customers";
import { getSettings } from "@/lib/repos/settings";
import { getOrCreateStripeCustomerId } from "@/lib/stripe-customer";

// Lists this customer's saved cards — empty list (never an error) whenever
// card payments aren't configured yet, or this customer has never paid by
// card, so the account page can always render a plain "no saved cards" state
// instead of a broken one.
export async function GET() {
  const session = await getCustomerSession();
  if (!session) {
    return NextResponse.json({ error: "Неоторизиран достъп" }, { status: 401 });
  }
  const settings = await getSettings();
  if (!settings.stripe_secret_key) {
    return NextResponse.json({ cards: [] });
  }
  const customer = await getCustomer(session.customerId);
  if (!customer?.stripe_customer_id) {
    return NextResponse.json({ cards: [] });
  }
  const stripe = new Stripe(settings.stripe_secret_key);
  const methods = await stripe.paymentMethods.list({
    customer: customer.stripe_customer_id,
    type: "card",
  });
  const cards = methods.data.map((pm) => ({
    id: pm.id,
    brand: pm.card?.brand ?? "card",
    last4: pm.card?.last4 ?? "????",
    expMonth: pm.card?.exp_month ?? 0,
    expYear: pm.card?.exp_year ?? 0,
  }));
  return NextResponse.json({ cards });
}

// Starts an "add a card" flow: a Stripe Checkout Session in setup mode
// (no charge — just collects and attaches a card to this customer). The
// browser redirects there directly, same pattern as the existing card
// payment flow at checkout, so no Stripe.js/Elements integration is needed
// on our own pages.
export async function POST(req: NextRequest) {
  const session = await getCustomerSession();
  if (!session) {
    return NextResponse.json({ error: "Неоторизиран достъп" }, { status: 401 });
  }
  const settings = await getSettings();
  if (!settings.stripe_secret_key) {
    return NextResponse.json(
      { error: "Картовите плащания все още не са конфигурирани." },
      { status: 400 }
    );
  }
  try {
    const stripe = new Stripe(settings.stripe_secret_key);
    const stripeCustomerId = await getOrCreateStripeCustomerId(stripe, session.customerId);
    const origin = req.nextUrl.origin;
    const setupSession = await stripe.checkout.sessions.create({
      mode: "setup",
      customer: stripeCustomerId,
      payment_method_types: ["card"],
      success_url: `${origin}/account?tab=payment&added=1`,
      cancel_url: `${origin}/account?tab=payment`,
    });
    return NextResponse.json({ url: setupSession.url });
  } catch (err) {
    console.error("Stripe setup session error", err);
    return NextResponse.json(
      { error: "Грешка при добавяне на картата. Опитайте отново." },
      { status: 500 }
    );
  }
}
