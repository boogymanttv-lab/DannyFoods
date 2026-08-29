import { NextRequest, NextResponse } from "next/server";
import {
  listProducts,
  createProduct,
  setProductSizes,
  setComboItems,
  computeComboPrice,
} from "@/lib/repos/products";

export async function GET() {
  const products = await listProducts({ activeOnly: false });
  return NextResponse.json({ products });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.name || !body?.category_id) {
    return NextResponse.json({ error: "Име и категория са задължителни" }, { status: 400 });
  }
  const isCombo = Boolean(body.is_combo);
  const comboItems = Array.isArray(body.combo_items) ? body.combo_items : [];
  const discountPercent = Number(body.combo_discount_percent) || 0;
  if (isCombo && comboItems.length === 0) {
    return NextResponse.json(
      { error: "Изберете поне един продукт, който да влиза в комбото" },
      { status: 400 }
    );
  }
  if (!isCombo && body.base_price == null) {
    return NextResponse.json({ error: "Базова цена е задължителна" }, { status: 400 });
  }
  // A combo's price is never taken from the client — it's always computed
  // here from its components' live prices, so it can't be tampered with
  // and never drifts out of sync with what the components actually cost.
  const basePrice = isCombo
    ? await computeComboPrice(comboItems, discountPercent)
    : Number(body.base_price);
  const id = await createProduct({
    category_id: Number(body.category_id),
    name: body.name,
    description: body.description ?? "",
    image: body.image ?? "",
    base_price: basePrice,
    is_pizza: Boolean(body.is_pizza),
    featured: Boolean(body.featured),
    sort_order: body.sort_order ?? 0,
    is_combo: isCombo,
    combo_discount_percent: discountPercent,
  });
  if (Array.isArray(body.sizes) && body.sizes.length > 0) {
    await setProductSizes(id, body.sizes);
  }
  if (isCombo) {
    await setComboItems(id, comboItems);
  }
  return NextResponse.json({ id, base_price: basePrice });
}
