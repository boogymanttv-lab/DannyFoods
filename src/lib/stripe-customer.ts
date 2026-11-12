import type Stripe from "stripe";
import { getCustomer, updateCustomer } from "@/lib/repos/customers";

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
