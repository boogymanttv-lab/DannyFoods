import { NextResponse } from "next/server";
import { listPromoCards } from "@/lib/repos/promo-cards";

// Already gated to admins-only by src/proxy.ts (every /api/admin/* path
// requires a valid admin session cookie).
export async function GET() {
  const cards = await listPromoCards();
  return NextResponse.json({ cards });
}
