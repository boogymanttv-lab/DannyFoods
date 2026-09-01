import { NextRequest, NextResponse } from "next/server";
import { listExtras, createExtra, setExtraOptions } from "@/lib/repos/products";

export async function GET() {
  const extras = await listExtras();
  return NextResponse.json({ extras });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.name || body?.price == null) {
    return NextResponse.json({ error: "Име и цена са задължителни" }, { status: 400 });
  }
  const id = await createExtra({
    name: body.name,
    price: Number(body.price),
    category_id: body.category_id ?? null,
    product_id: body.product_id ?? null,
  });
  if (Array.isArray(body.options) && body.options.length > 0) {
    await setExtraOptions(id, body.options);
  }
  return NextResponse.json({ id });
}
