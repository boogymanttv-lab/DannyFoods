import { NextRequest, NextResponse } from "next/server";
import { listOrders } from "@/lib/repos/orders";
import type { OrderStatus } from "@/lib/types";

export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get("status") as OrderStatus | null;
  const orders = await listOrders({ status: status ?? undefined, limit: 200 });
  return NextResponse.json({ orders });
}
