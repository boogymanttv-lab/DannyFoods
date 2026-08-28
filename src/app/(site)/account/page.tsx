import { redirect } from "next/navigation";
import { getCustomerSession } from "@/lib/auth";
import { getCustomerPublic, listAddresses } from "@/lib/repos/customers";
import { listOrdersForCustomer } from "@/lib/repos/orders";
import { listZones } from "@/lib/repos/zones";
import { AccountDashboard } from "@/components/site/AccountDashboard";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await getCustomerSession();
  // proxy.ts already guards this route, but stay defensive in case the
  // session cookie verified there and expired by the time this renders.
  if (!session) redirect("/account/login");

  const customer = await getCustomerPublic(session.customerId);
  if (!customer) redirect("/account/login");

  const addresses = await listAddresses(customer.id);
  const orders = await listOrdersForCustomer(customer.id);
  const zones = await listZones(true);

  return (
    <AccountDashboard customer={customer} addresses={addresses} orders={orders} zones={zones} />
  );
}
