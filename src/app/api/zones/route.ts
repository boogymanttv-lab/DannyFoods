import { NextResponse } from "next/server";
import { listZones } from "@/lib/repos/zones";

export async function GET() {
  const zones = await listZones(true);
  return NextResponse.json({ zones });
}
