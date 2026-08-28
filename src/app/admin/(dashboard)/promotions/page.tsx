import { listPromotions } from "@/lib/repos/promotions";
import { PromotionsManager } from "@/components/admin/PromotionsManager";

export const dynamic = "force-dynamic";

export default async function AdminPromotionsPage() {
  const promotions = await listPromotions();
  return <PromotionsManager initialPromotions={promotions} />;
}
