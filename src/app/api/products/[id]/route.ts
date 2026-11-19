import { NextRequest, NextResponse } from "next/server";
import { errJson } from "@/lib/i18n/api";
import { getProduct } from "@/lib/repos/products";
import { getLocale } from "@/lib/i18n/locale";
import { localizeProductsDeep } from "@/lib/i18n/content";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const productId = Number(id);
  if (!Number.isInteger(productId) || productId <= 0) {
    return await errJson("Невалиден продукт", 400);
  }
  const product = await getProduct(productId);
  if (!product || !product.active) {
    return await errJson("Продуктът не е наличен", 404);
  }
  const [localized] = await localizeProductsDeep([product], await getLocale());
  return NextResponse.json({ product: localized });
}
