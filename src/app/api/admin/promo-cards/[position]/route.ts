import { NextRequest, NextResponse } from "next/server";
import { updatePromoCard } from "@/lib/repos/promo-cards";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ position: string }> }
) {
  const { position } = await params;
  const pos = Number(position);
  if (!Number.isInteger(pos) || pos < 1 || pos > 4) {
    return NextResponse.json({ error: "Невалидна позиция" }, { status: 400 });
  }
  const body = await req.json().catch(() => ({}));
  await updatePromoCard(pos, {
    active: Boolean(body.active),
    title: String(body.title ?? "").trim(),
    subtitle: String(body.subtitle ?? "").trim(),
    description: String(body.description ?? "").trim(),
    image: String(body.image ?? "").trim(),
  });
  return NextResponse.json({ ok: true });
}
