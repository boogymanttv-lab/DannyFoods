import { NextRequest, NextResponse } from "next/server";
import { updateExtra, deleteExtra, setExtraOptions } from "@/lib/repos/products";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { options, ...rest } = body;
  if (Object.keys(rest).length > 0) {
    await updateExtra(Number(id), rest);
  }
  if (Array.isArray(options)) {
    await setExtraOptions(Number(id), options);
  }
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
