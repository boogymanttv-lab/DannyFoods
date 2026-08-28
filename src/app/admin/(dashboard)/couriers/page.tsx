import { listCouriers } from "@/lib/repos/couriers";
import { CouriersManager } from "@/components/admin/CouriersManager";

export const dynamic = "force-dynamic";

export default async function AdminCouriersPage() {
  const couriers = await listCouriers(false);
  return <CouriersManager initialCouriers={couriers} />;
}
