import { NextRequest, NextResponse } from "next/server";
import { getCourierSession } from "@/lib/auth";
import { updateCourierLocation } from "@/lib/repos/couriers";

export async function POST(req: NextRequest) {
  const session = await getCourierSession();
  if (!session) {
    return NextResponse.json({ error: "Неоторизиран достъп" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const lat = Number(body?.lat);
  const lng = Number(body?.lng);
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return NextResponse.json({ error: "Невалидни координати" }, { status: 400 });
  }
  await updateCourierLocation(session.courierId, lat, lng);
  return NextResponse.json({ ok: true });
}
