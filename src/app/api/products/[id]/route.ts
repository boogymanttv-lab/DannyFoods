import { NextRequest, NextResponse } from "next/server";
import { getProduct } from "@/lib/repos/products";

// Public — a single product's current, live data (image, price, sizes,
// extras). Used by "Поръчай отново" (see AccountDashboard.tsx) to refresh a
// past order's line with the product's current photo and to confirm it's
// still orderable, without needing the full menu payload. Only ever
// returns active products — a deleted or hidden (e.g. combo-backing)
// product simply 404s, same as if it didn't exist for this purpose.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const productId = Number(id);
  if (!Number.isInteger(productId) || productId <= 0) {
    return NextResponse.json({ error: "Невалиден продукт" }, { status: 400 });
  }
  const product = await getProduct(productId);
  if (!product || !product.active) {
    return NextResponse.json({ error: "Продуктът не е наличен" }, { status: 404 });
  }
  return NextResponse.json({ product });
}
