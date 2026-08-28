import { NextResponse } from "next/server";
import { getCourierSession } from "@/lib/auth";
import { listAvailableOrdersForCourier } from "@/lib/repos/orders";
import { getZone } from "@/lib/repos/zones";

export async function GET() {
  const session = await getCourierSession();
  if (!session) {
    return NextResponse.json({ error: "Неоторизиран достъп" }, { status: 401 });
  }
  const rows = await listAvailableOrdersForCourier();
  const orders = await Promise.all(
    rows.map(async (o) => ({
      ...o,
      zone: o.zone_id ? await getZone(o.zone_id) : undefined,
    }))
  );
  return NextResponse.json({ orders });
}
