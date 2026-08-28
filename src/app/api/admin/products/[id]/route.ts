import { NextRequest, NextResponse } from "next/server";
import { updateProduct, deleteProduct, setProductSizes } from "@/lib/repos/products";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { sizes, ...rest } = body;
  if (Object.keys(rest).length > 0) {
    await updateProduct(Number(id), rest);
  }
  if (Array.isArray(sizes)) {
    await setProductSizes(Number(id), sizes);
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await deleteProduct(Number(id));
  return NextResponse.json({ ok: true });
}
