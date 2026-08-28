import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getCustomerByEmail } from "@/lib/repos/customers";
import {
  createCustomerSessionToken,
  setCustomerSessionCookie,
  maybeGrantAdminAccess,
} from "@/lib/auth";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = body?.email;
  const password = body?.password;
  if (!email || !password) {
    return NextResponse.json({ error: "Въведете имейл и парола" }, { status: 400 });
  }

  const customer = await getCustomerByEmail(email);
  if (!customer || !customer.password_hash) {
    return NextResponse.json(
      { error: "Грешен имейл или парола, или акаунтът е създаден през Google." },
      { status: 401 }
    );
  }
  const valid = await bcrypt.compare(password, customer.password_hash);
  if (!valid) {
    return NextResponse.json({ error: "Грешен имейл или парола" }, { status: 401 });
  }

  const token = await createCustomerSessionToken({
    customerId: customer.id,
    name: customer.name,
    email: customer.email,
  });
  await setCustomerSessionCookie(token);

  const isAdmin = await maybeGrantAdminAccess(customer.email, customer.name, customer.id);

  return NextResponse.json({ ok: true, isAdmin });
}
