import { listPromoCards } from "@/lib/repos/promo-cards";
import { listProducts, getProduct } from "@/lib/repos/products";
import { PromoCardsManager } from "@/components/admin/PromoCardsManager";
import type { ComboItemRow } from "@/lib/combo-preview";

export const dynamic = "force-dynamic";

export default async function AdminShowcasePage() {
  const cards = await listPromoCards();
  const products = await listProducts({ activeOnly: false });

  // For any card already built from the combo picker, pull its hidden
  // product's current bill of materials + discount so the form reopens
  // exactly as it was left, instead of looking freshly empty.
  const initialCombos: Record<number, { discountPercent: number; items: ComboItemRow[] }> = {};
  for (const card of cards) {
    if (!card.linked_product_id) continue;
    const linked = await getProduct(card.linked_product_id);
    if (!linked) continue;
    initialCombos[card.position] = {
      discountPercent: linked.combo_discount_percent,
      items: linked.combo_items.map((ci) => ({
        product_id: ci.product_id,
        size_id: ci.size_id,
        quantity: ci.quantity,
      })),
    };
  }

  return (
    <PromoCardsManager
      initialCards={cards}
      initialProducts={products}
      initialCombos={initialCombos}
    />
  );
}
