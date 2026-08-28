import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { updateCourier, deleteCourier } from "@/lib/repos/couriers";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { password, ...rest } = body;
  const payload: Record<string, unknown> = { ...rest };
  if (password) {
    payload.password_hash = await bcrypt.hash(password, 10);
  }
  await updateCourier(Number(id), payload);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await deleteCourier(Number(id));
  return NextResponse.json({ ok: true });
}
