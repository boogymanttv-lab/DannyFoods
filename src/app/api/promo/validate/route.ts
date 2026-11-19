import { NextRequest, NextResponse } from "next/server";
import { errJson } from "@/lib/i18n/api";
import { getLocale } from "@/lib/i18n/locale";
import { translateOne } from "@/lib/i18n/auto";
import { validatePromotion } from "@/lib/repos/promotions";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const code = body?.code;
  const subtotal = Number(body?.subtotal);
  if (!code || typeof code !== "string" || Number.isNaN(subtotal)) {
    return await errJson("Невалидна заявка", 400, { ok: false });
  }
  const result = await validatePromotion(code, subtotal);
  if (!result.ok) {
    return errJson(result.error, 400, { ok: false });
  }
  const locale = await getLocale();
  return NextResponse.json({
    ok: true,
    discount: result.discount,
    description: await translateOne(result.promotion.description, locale),
  });
}
