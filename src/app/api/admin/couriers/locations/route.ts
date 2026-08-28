import { NextResponse } from "next/server";
import { listActiveCourierLocations } from "@/lib/repos/couriers";

export async function GET() {
  const couriers = await listActiveCourierLocations();
  return NextResponse.json({ couriers });
}
