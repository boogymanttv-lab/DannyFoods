import { NextRequest, NextResponse } from "next/server";
import { updatePromotion, deletePromotion } from "@/lib/repos/promotions";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  await updatePromotion(Number(id), body);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await deletePromotion(Number(id));
  return NextResponse.json({ ok: true });
}
