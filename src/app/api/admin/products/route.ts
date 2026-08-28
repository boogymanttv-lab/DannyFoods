import { NextRequest, NextResponse } from "next/server";
import { listProducts, createProduct, setProductSizes } from "@/lib/repos/products";

export async function GET() {
  const products = await listProducts({ activeOnly: false });
  return NextResponse.json({ products });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.name || !body?.category_id || body?.base_price == null) {
    return NextResponse.json(
      { error: "Име, категория и базова цена са задължителни" },
      { status: 400 }
    );
  }
  const id = await createProduct({
    category_id: Number(body.category_id),
    name: body.name,
    description: body.description ?? "",
    image: body.image ?? "",
    base_price: Number(body.base_price),
    weight_label: body.weight_label ?? "",
    is_pizza: Boolean(body.is_pizza),
    featured: Boolean(body.featured),
    sort_order: body.sort_order ?? 0,
  });
  if (Array.isArray(body.sizes) && body.sizes.length > 0) {
    await setProductSizes(id, body.sizes);
  }
  return NextResponse.json({ id });
}
