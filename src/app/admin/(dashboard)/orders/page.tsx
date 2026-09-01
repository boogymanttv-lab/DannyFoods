import { getSession } from "@/lib/auth";
import { OrdersManager } from "@/components/admin/OrdersManager";

export default async function AdminOrdersPage() {
  const session = await getSession();
  const station = session?.station ?? "all";
  return <OrdersManager station={station} />;
}
