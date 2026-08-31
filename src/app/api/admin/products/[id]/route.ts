import { NextRequest, NextResponse } from "next/server";
import {
  updateProduct,
  deleteProduct,
  setProductSizes,
  setComboItems,
  computeComboPrice,
  getProduct,
} from "@/lib/repos/products";
import { getSettings } from "@/lib/repos/settings";
import { autoTranslateFields } from "@/lib/translate";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const productId = Number(id);
  const body = await req.json().catch(() => ({}));
  const { sizes, combo_items, ...rest } = body;

  // Only the full product-form save sends `is_combo` at all — a plain
  // active/sort_order toggle never touches combo pricing or membership.
  if ("is_combo" in rest) {
    if (rest.is_combo) {
      const items = Array.isArray(combo_items) ? combo_items : [];
      const discountPercent = Number(rest.combo_discount_percent) || 0;
      // Recomputed here too, from components' current live prices, rather
      // than trusting whatever number the client displayed.
      rest.base_price = await computeComboPrice(items, discountPercent);
    } else {
      // Switched off combo mode — its old bill of materials no longer means
      // anything, so drop it rather than leaving stale rows behind.
      await setComboItems(productId, []);
    }
  }

  // Only the full product-form save touches name/description at all — a
  // plain active/sort_order toggle shouldn't burn a DeepL call re-translating
  // text that hasn't changed.
  if ("name" in rest || "description" in rest) {
    const existing = await getProduct(productId);
    const settings = await getSettings();
    const { name_en, description_en } = await autoTranslateFields(
      {
        name: rest.name ?? existing?.name ?? "",
        description: rest.description ?? existing?.description ?? "",
      },
      settings.deepl_api_key
    );
    rest.name_en = name_en;
    rest.description_en = description_en;
  }

  if (Object.keys(rest).length > 0) {
    await updateProduct(productId, rest);
  }
  if (Array.isArray(sizes)) {
    await setProductSizes(productId, sizes);
  }
  if (rest.is_combo && Array.isArray(combo_items)) {
    await setComboItems(productId, combo_items);
  }
  return NextResponse.json({ ok: true, base_price: rest.base_price });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await deleteProduct(Number(id));
  return NextResponse.json({ ok: true });
}
