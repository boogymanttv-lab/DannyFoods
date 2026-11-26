import { NextResponse } from "next/server";
import { countSubscriptionsByCourier } from "@/lib/repos/push";

export const dynamic = "force-dynamic";

// How many phones each courier has notifications enabled on.
export async function GET() {
  const counts = await countSubscriptionsByCourier();
  return NextResponse.json({
    counts,
    configured: Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
  });
}
