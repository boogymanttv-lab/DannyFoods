import { NextResponse } from "next/server";
import { countActiveOrders } from "@/lib/repos/orders";

export async function GET() {
  return NextResponse.json({ activeOrders: await countActiveOrders() });
}
