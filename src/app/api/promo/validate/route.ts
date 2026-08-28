import { NextRequest, NextResponse } from "next/server";
import { validatePromotion } from "@/lib/repos/promotions";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const code = body?.code;
  const subtotal = Number(body?.subtotal);
  if (!code || typeof code !== "string" || Number.isNaN(subtotal)) {
    return NextResponse.json({ ok: false, error: "Невалидна заявка" }, { status: 400 });
  }
  const result = await validatePromotion(code, subtotal);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }
  return NextResponse.json({
    ok: true,
    discount: result.discount,
    description: result.promotion.description,
  });
}
