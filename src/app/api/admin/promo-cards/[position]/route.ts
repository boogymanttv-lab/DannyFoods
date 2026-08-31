import { NextRequest, NextResponse } from "next/server";
import { updatePromoCard, getPromoCardByPosition } from "@/lib/repos/promo-cards";
import {
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  setComboItems,
  computeComboPrice,
} from "@/lib/repos/products";
import { formatPrice } from "@/lib/format";
import type { ComboItemRow } from "@/lib/combo-preview";
import { getSettings } from "@/lib/repos/settings";
import { autoTranslateFields } from "@/lib/translate";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ position: string }> }
) {
  const { position } = await params;
  const pos = Number(position);
  if (!Number.isInteger(pos) || pos < 1 || pos > 4) {
    return NextResponse.json({ error: "Невалидна позиция" }, { status: 400 });
  }
  const body = await req.json().catch(() => ({}));
  const title = String(body.title ?? "").trim();
  const description = String(body.description ?? "").trim();
  const image = String(body.image ?? "").trim();
  let subtitle = String(body.subtitle ?? "").trim();

  const useCombo = Boolean(body.use_combo);
  const comboItems = (Array.isArray(body.combo_items) ? body.combo_items : []) as ComboItemRow[];
  const discountPercent = Number(body.combo_discount_percent) || 0;

  const existing = await getPromoCardByPosition(pos);
  let linkedProductId = existing?.linked_product_id ?? null;

  if (useCombo && comboItems.length > 0) {
    const price = await computeComboPrice(comboItems, discountPercent);
    // The hidden product needs *some* category — borrow the first
    // selected component's own category, since this product is never
    // browsed by category anyway (active = 0 keeps it out of the menu).
    const firstComponent = await getProduct(comboItems[0].product_id);
    const categoryId = firstComponent?.category_id ?? 1;
    const productData = {
      category_id: categoryId,
      name: title || "Оферта",
      description,
      image,
      base_price: price,
      is_combo: true,
      combo_discount_percent: discountPercent,
      active: false,
    };
    if (linkedProductId) {
      await updateProduct(linkedProductId, productData);
    } else {
      linkedProductId = await createProduct(productData);
    }
    await setComboItems(linkedProductId, comboItems);
    // The card's own subtitle becomes the computed price — that's the one
    // number the customer is meant to see, so it isn't left to whatever
    // text an admin typed before switching this card into combo mode.
    subtitle = formatPrice(price);
  } else if (linkedProductId) {
    // Combo mode got turned off (or its item list emptied) — the hidden
    // product no longer means anything, so remove it rather than leaving
    // an orphaned, invisible row behind.
    await deleteProduct(linkedProductId);
    linkedProductId = null;
  }

  const settings = await getSettings();
  const { name_en: title_en, description_en } = await autoTranslateFields(
    { name: title, description },
    settings.deepl_api_key
  );

  await updatePromoCard(pos, {
    active: Boolean(body.active),
    badge: String(body.badge ?? "").trim(),
    title,
    title_en,
    subtitle,
    description,
    description_en,
    image,
    fullBanner: Boolean(body.fullBanner),
    linkedProductId,
  });

  return NextResponse.json({ ok: true, linked_product_id: linkedProductId, subtitle });
}
