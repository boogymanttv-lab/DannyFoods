import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { createCustomer, getCustomerByEmail } from "@/lib/repos/customers";
import {
  createCustomerSessionToken,
  setCustomerSessionCookie,
  maybeGrantAdminAccess,
} from "@/lib/auth";

const schema = z.object({
  name: z.string().min(2).max(100),
  phone: z.string().max(30).optional(),
  email: z.string().email().max(150),
  password: z.string().min(6).max(100),
});

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Моля, попълнете коректно всички полета." }, { status: 400 });
  }
  const data = parsed.data;

  const existing = await getCustomerByEmail(data.email);
  if (existing) {
    return NextResponse.json(
      { error: "Вече има регистрация с този имейл. Опитайте да влезете." },
      { status: 400 }
    );
  }

  const password_hash = await bcrypt.hash(data.password, 10);
  const customerId = await createCustomer({
    name: data.name,
    email: data.email,
    phone: data.phone,
    password_hash,
  });

  const token = await createCustomerSessionToken({
    customerId,
    name: data.name,
    email: data.email.trim().toLowerCase(),
  });
  await setCustomerSessionCookie(token);

  const isAdmin = await maybeGrantAdminAccess(data.email, data.name, customerId);

  return NextResponse.json({ ok: true, isAdmin });
}
