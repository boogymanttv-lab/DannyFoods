import { NextResponse } from "next/server";
import { clearCourierSessionCookie } from "@/lib/auth";

export async function POST() {
  await clearCourierSessionCookie();
  return NextResponse.json({ ok: true });
}
