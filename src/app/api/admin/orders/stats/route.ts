import { NextResponse } from "next/server";
import { countActiveOrders } from "@/lib/repos/orders";

// Used by the admin orders panel to auto-suggest a longer delivery-time
// estimate when the kitchen/couriers currently have a lot of orders in
// the pipeline — independent of the time-of-day "busy hours" suggestion.
export async function GET() {
  return NextResponse.json({ activeOrders: await countActiveOrders() });
}
