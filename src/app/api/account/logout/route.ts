import { NextResponse } from "next/server";
import { clearCustomerSessionCookie } from "@/lib/auth";

export async function POST() {
  await clearCustomerSessionCookie();
  return NextResponse.json({ ok: true });
}
