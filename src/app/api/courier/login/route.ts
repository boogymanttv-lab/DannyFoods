import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getCourierByPhone } from "@/lib/repos/couriers";
import { createCourierSessionToken, setCourierSessionCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const phone = body?.phone;
  const password = body?.password;
  if (!phone || !password) {
    return NextResponse.json({ error: "Въведете телефон и парола" }, { status: 400 });
  }

  const courier = await getCourierByPhone(phone);
  if (!courier || !courier.active) {
    return NextResponse.json({ error: "Грешен телефон или парола" }, { status: 401 });
  }
  const valid = await bcrypt.compare(password, courier.password_hash);
  if (!valid) {
    return NextResponse.json({ error: "Грешен телефон или парола" }, { status: 401 });
  }

  const token = await createCourierSessionToken({
    courierId: courier.id,
    name: courier.name,
    phone: courier.phone,
  });
  await setCourierSessionCookie(token);

  return NextResponse.json({ ok: true });
}
