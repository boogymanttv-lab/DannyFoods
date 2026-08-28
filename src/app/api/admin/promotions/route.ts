import { NextRequest, NextResponse } from "next/server";
import { listPromotions, createPromotion } from "@/lib/repos/promotions";

export async function GET() {
  const promotions = await listPromotions();
  return NextResponse.json({ promotions });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.code || body?.discount_value == null || !body?.discount_type) {
    return NextResponse.json(
      { error: "Код, тип и стойност на отстъпката са задължителни" },
      { status: 400 }
    );
  }
  try {
    const id = await createPromotion({
      code: body.code,
      description: body.description ?? "",
      discount_type: body.discount_type,
      discount_value: Number(body.discount_value),
      min_order: Number(body.min_order ?? 0),
      starts_at: body.starts_at || null,
      ends_at: body.ends_at || null,
      usage_limit: body.usage_limit ? Number(body.usage_limit) : null,
    });
    return NextResponse.json({ id });
  } catch {
    return NextResponse.json({ error: "Промо кодът вече съществува" }, { status: 400 });
  }
}
