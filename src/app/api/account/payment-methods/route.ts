import { NextRequest, NextResponse } from "next/server";
import { errJson } from "@/lib/i18n/api";
import Stripe from "stripe";
import { getCustomerSession } from "@/lib/auth";
import { getCustomer } from "@/lib/repos/customers";
import { getSettings } from "@/lib/repos/settings";
import { getOrCreateStripeCustomerId } from "@/lib/stripe-customer";

export async function GET() {
  const session = await getCustomerSession();
  if (!session) {
    return await errJson("Неоторизиран достъп", 401);
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

export async function POST(req: NextRequest) {
  const session = await getCustomerSession();
  if (!session) {
    return await errJson("Неоторизиран достъп", 401);
  }
  const settings = await getSettings();
  if (!settings.stripe_secret_key) {
    return await errJson("Картовите плащания все още не са конфигурирани.", 400);
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
    return await errJson("Грешка при добавяне на картата. Опитайте отново.", 500);
  }
}
