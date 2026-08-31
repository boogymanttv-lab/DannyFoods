import { NextRequest, NextResponse } from "next/server";
import { updateCategory, deleteCategory } from "@/lib/repos/categories";
import { getSettings } from "@/lib/repos/settings";
import { autoTranslateFields } from "@/lib/translate";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  if ("name" in body) {
    const settings = await getSettings();
    const { name_en } = await autoTranslateFields({ name: body.name }, settings.deepl_api_key);
    body.name_en = name_en;
  }
  await updateCategory(Number(id), body);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await deleteCategory(Number(id));
  return NextResponse.json({ ok: true });
}
