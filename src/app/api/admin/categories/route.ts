import { NextRequest, NextResponse } from "next/server";
import { listCategories, createCategory } from "@/lib/repos/categories";

export async function GET() {
  const categories = await listCategories(false);
  return NextResponse.json({ categories });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.name || !body?.slug) {
    return NextResponse.json({ error: "Име и slug са задължителни" }, { status: 400 });
  }
  const id = await createCategory({
    slug: body.slug,
    name: body.name,
    icon: body.icon ?? "",
    sort_order: body.sort_order ?? 0,
  });
  return NextResponse.json({ id });
}
