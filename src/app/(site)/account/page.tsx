import { redirect } from "next/navigation";
import { getCustomerSession } from "@/lib/auth";
import { getCustomerPublic, listAddresses } from "@/lib/repos/customers";
import { listOrdersForCustomer } from "@/lib/repos/orders";
import { AccountDashboard } from "@/components/site/AccountDashboard";
import { getLocale } from "@/lib/i18n/locale";
import { translateMany } from "@/lib/i18n/auto";
import { localizedTitle } from "@/lib/i18n/meta";
import type { OrderItem } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return localizedTitle("Профил");
}

export default async function AccountPage() {
  const session = await getCustomerSession();
  if (!session) redirect("/account/login");

  const customer = await getCustomerPublic(session.customerId);
  if (!customer) redirect("/account/login");

  const addresses = await listAddresses(customer.id);
  const orders = await listOrdersForCustomer(customer.id);

  const locale = await getLocale();
  let translations: Record<string, string> = {};
  if (locale === "en") {
    const strings: string[] = [];
    for (const o of orders) {
      try {
        const items: OrderItem[] = JSON.parse(o.items_json);
        for (const item of items) {
          strings.push(item.name);
          for (const e of item.extras ?? []) strings.push(e.name);
        }
      } catch {}
    }
    translations = Object.fromEntries(await translateMany(strings));
  }

  return (
    <AccountDashboard
      customer={customer}
      addresses={addresses}
      orders={orders}
      translations={translations}
    />
  );
}
