import { NextResponse } from "next/server";
import { listPromoCards } from "@/lib/repos/promo-cards";

export async function GET() {
  const cards = await listPromoCards();
  return NextResponse.json({ cards });
}
