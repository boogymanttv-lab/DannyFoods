import { NextRequest, NextResponse } from "next/server";
import { updateExtra, deleteExtra } from "@/lib/repos/products";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  await updateExtra(Number(id), body);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await deleteExtra(Number(id));
  return NextResponse.json({ ok: true });
}
