import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getCustomerSession } from "@/lib/auth";
import { getCustomer } from "@/lib/repos/customers";
import { getSettings } from "@/lib/repos/settings";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getCustomerSession();
  if (!session) {
    return NextResponse.json({ error: "Неоторизиран достъп" }, { status: 401 });
  }
  const { id } = await params;
  const settings = await getSettings();
  if (!settings.stripe_secret_key) {
    return NextResponse.json({ error: "Картовите плащания не са конфигурирани." }, { status: 400 });
  }
  const customer = await getCustomer(session.customerId);
  if (!customer?.stripe_customer_id) {
    return NextResponse.json({ error: "Картата не е намерена" }, { status: 404 });
  }
  try {
    const stripe = new Stripe(settings.stripe_secret_key);
    // Confirm this payment method actually belongs to THIS customer before
    // detaching it — the id in the URL is just a Stripe payment method id,
    // so without this check one logged-in customer could remove another's
    // saved card by guessing/reusing an id.
    const pm = await stripe.paymentMethods.retrieve(id);
    const owner = typeof pm.customer === "string" ? pm.customer : pm.customer?.id;
    if (owner !== customer.stripe_customer_id) {
      return NextResponse.json({ error: "Нямате достъп до тази карта" }, { status: 403 });
    }
    await stripe.paymentMethods.detach(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Stripe detach error", err);
    return NextResponse.json({ error: "Грешка при премахване на картата." }, { status: 500 });
  }
}
