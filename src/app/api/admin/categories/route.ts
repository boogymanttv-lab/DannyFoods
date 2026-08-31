import { NextRequest, NextResponse } from "next/server";
import { listCategories, createCategory } from "@/lib/repos/categories";
import { getSettings } from "@/lib/repos/settings";
import { autoTranslateFields } from "@/lib/translate";

export async function GET() {
  const categories = await listCategories(false);
  return NextResponse.json({ categories });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.name || !body?.slug) {
    return NextResponse.json({ error: "Име и slug са задължителни" }, { status: 400 });
  }
  const settings = await getSettings();
  const { name_en } = await autoTranslateFields({ name: body.name }, settings.deepl_api_key);
  const id = await createCategory({
    slug: body.slug,
    name: body.name,
    name_en,
    icon: body.icon ?? "",
    sort_order: body.sort_order ?? 0,
  });
  return NextResponse.json({ id });
}
