import { NextRequest, NextResponse } from "next/server";
import { errJson } from "@/lib/i18n/api";
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
    return await errJson("Неоторизиран достъп", 401);
  }
  const { id } = await params;
  const settings = await getSettings();
  if (!settings.stripe_secret_key) {
    return await errJson("Картовите плащания не са конфигурирани.", 400);
  }
  const customer = await getCustomer(session.customerId);
  if (!customer?.stripe_customer_id) {
    return await errJson("Картата не е намерена", 404);
  }
  try {
    const stripe = new Stripe(settings.stripe_secret_key);
    const pm = await stripe.paymentMethods.retrieve(id);
    const owner = typeof pm.customer === "string" ? pm.customer : pm.customer?.id;
    if (owner !== customer.stripe_customer_id) {
      return await errJson("Нямате достъп до тази карта", 403);
    }
    await stripe.paymentMethods.detach(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Stripe detach error", err);
    return await errJson("Грешка при премахване на картата.", 500);
  }
}
