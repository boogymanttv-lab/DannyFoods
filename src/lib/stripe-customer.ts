import type Stripe from "stripe";
import { getCustomer, updateCustomer } from "@/lib/repos/customers";

// Every logged-in customer who ever pays by card gets a matching Stripe
// Customer object, created lazily on first use and cached on our own
// `customers.stripe_customer_id` column. This is what makes "saved cards"
// possible at all: a card can only be reused/listed/removed later if it was
// attached to a real Stripe Customer when it was collected (see the
// `customer` + `payment_intent_data.setup_future_usage` params passed to the
// Checkout Session in /api/orders, and the /api/account/payment-methods
// routes that list/detach against this same id).
export async function getOrCreateStripeCustomerId(
  stripe: Stripe,
  customerId: number
): Promise<string> {
  const customer = await getCustomer(customerId);
  if (!customer) throw new Error("Customer not found");
  if (customer.stripe_customer_id) return customer.stripe_customer_id;

  const stripeCustomer = await stripe.customers.create({
    email: customer.email || undefined,
    name: customer.name || undefined,
    phone: customer.phone || undefined,
    metadata: { customerId: String(customerId) },
  });
  await updateCustomer(customerId, { stripe_customer_id: stripeCustomer.id });
  return stripeCustomer.id;
}
