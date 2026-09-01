import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getAdminByEmail } from "@/lib/repos/admin";
import { createSessionToken, setSessionCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = body?.email;
  const password = body?.password;
  if (!email || !password) {
    return NextResponse.json({ error: "Въведете имейл и парола" }, { status: 400 });
  }

  const admin = await getAdminByEmail(email);
  if (!admin) {
    return NextResponse.json({ error: "Грешен имейл или парола" }, { status: 401 });
  }
  const valid = await bcrypt.compare(password, admin.password_hash);
  if (!valid) {
    return NextResponse.json({ error: "Грешен имейл или парола" }, { status: 401 });
  }

  const token = await createSessionToken({
    adminId: admin.id,
    email: admin.email,
    name: admin.name,
    role: admin.role,
    station: admin.station,
  });
  await setSessionCookie(token);

  return NextResponse.json({ ok: true });
}
