import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { listStaff, createAdmin, getAdminByEmail } from "@/lib/repos/admin";

export async function GET() {
  const staff = await listStaff();
  return NextResponse.json({ staff });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.name || !body?.email || !body?.password) {
    return NextResponse.json(
      { error: "Име, имейл и парола са задължителни" },
      { status: 400 }
    );
  }
  const station = body.station === "pizza" || body.station === "other" ? body.station : "all";
  if (await getAdminByEmail(body.email)) {
    return NextResponse.json({ error: "Вече има профил с този имейл" }, { status: 400 });
  }
  const password_hash = await bcrypt.hash(body.password, 10);
  const id = await createAdmin({
    email: body.email,
    password_hash,
    name: body.name,
    role: "staff",
    station,
  });
  return NextResponse.json({ id });
}
