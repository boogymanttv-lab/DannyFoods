import { NextRequest, NextResponse } from "next/server";
import { listZones, createZone } from "@/lib/repos/zones";

export async function GET() {
  const zones = await listZones(false);
  return NextResponse.json({ zones });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.name || body?.delivery_fee == null) {
    return NextResponse.json({ error: "Име и цена за доставка са задължителни" }, { status: 400 });
  }
  const id = await createZone({
    name: body.name,
    delivery_fee: Number(body.delivery_fee),
    min_order: Number(body.min_order ?? 15),
    sort_order: body.sort_order ?? 0,
  });
  return NextResponse.json({ id });
}
