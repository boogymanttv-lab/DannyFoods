import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { listCouriers, createCourier, getCourierByPhone } from "@/lib/repos/couriers";

export async function GET() {
  const couriers = await listCouriers(false);
  return NextResponse.json({ couriers });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.name || !body?.phone || !body?.password) {
    return NextResponse.json(
      { error: "Име, телефон и парола са задължителни" },
      { status: 400 }
    );
  }
  if (await getCourierByPhone(body.phone)) {
    return NextResponse.json(
      { error: "Вече има куриер с този телефон" },
      { status: 400 }
    );
  }
  const password_hash = await bcrypt.hash(body.password, 10);
  const id = await createCourier({ name: body.name, phone: body.phone, password_hash });
  return NextResponse.json({ id });
}
