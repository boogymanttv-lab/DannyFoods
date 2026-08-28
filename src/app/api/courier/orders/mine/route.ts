import { NextResponse } from "next/server";
import { getCourierSession } from "@/lib/auth";
import { listOrdersForCourier, listDeliveredOrdersForCourier } from "@/lib/repos/orders";
import { getZone } from "@/lib/repos/zones";

export async function GET() {
  const session = await getCourierSession();
  if (!session) {
    return NextResponse.json({ error: "Неоторизиран достъп" }, { status: 401 });
  }
  const activeRows = await listOrdersForCourier(session.courierId);
  const active = await Promise.all(
    activeRows.map(async (o) => ({
      ...o,
      zone: o.zone_id ? await getZone(o.zone_id) : undefined,
    }))
  );
  const deliveredRows = await listDeliveredOrdersForCourier(session.courierId, 15);
  const delivered = await Promise.all(
    deliveredRows.map(async (o) => ({
      ...o,
      zone: o.zone_id ? await getZone(o.zone_id) : undefined,
    }))
  );
  return NextResponse.json({ active, delivered });
}
