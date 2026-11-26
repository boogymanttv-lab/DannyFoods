import { NextRequest, NextResponse } from "next/server";
import { listOrders } from "@/lib/repos/orders";
import { shopClock } from "@/lib/delivery-slots";
import type { OrderStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get("status") as OrderStatus | null;
  // Only one working day is shown at a time (Bulgarian calendar day, not the
  // server's UTC day), so yesterday's orders don't pile up on today's list.
  const dayParam = req.nextUrl.searchParams.get("day") ?? "";
  const today = shopClock(new Date()).dateKey;
  const day = /^\d{4}-\d{2}-\d{2}$/.test(dayParam) ? dayParam : today;
  const orders = await listOrders({ status: status ?? undefined, shopDay: day, limit: 500 });
  return NextResponse.json(
    { orders, day, today },
    { headers: { "Cache-Control": "no-store" } }
  );
}
