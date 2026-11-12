import { NextRequest, NextResponse } from "next/server";
import { getProduct } from "@/lib/repos/products";

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
