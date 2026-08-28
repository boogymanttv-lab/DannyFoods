import { NextRequest, NextResponse } from "next/server";
import { updateZone, deleteZone } from "@/lib/repos/zones";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  await updateZone(Number(id), body);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await deleteZone(Number(id));
  return NextResponse.json({ ok: true });
}
