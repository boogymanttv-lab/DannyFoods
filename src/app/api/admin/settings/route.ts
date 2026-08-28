import { NextRequest, NextResponse } from "next/server";
import { getSettings, updateSettings } from "@/lib/repos/settings";

export async function GET() {
  const settings = await getSettings();
  return NextResponse.json({ settings });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  await updateSettings(body);
  return NextResponse.json({ ok: true });
}
