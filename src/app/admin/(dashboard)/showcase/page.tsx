import { listPromoCards } from "@/lib/repos/promo-cards";
import { PromoCardsManager } from "@/components/admin/PromoCardsManager";

export const dynamic = "force-dynamic";

export default async function AdminShowcasePage() {
  const cards = await listPromoCards();
  return <PromoCardsManager initialCards={cards} />;
}
