import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCustomerSession } from "@/lib/auth";
import { updateCustomer, getCustomerPublic } from "@/lib/repos/customers";

const schema = z.object({
  name: z.string().min(2).max(100).optional(),
  phone: z.string().max(30).optional(),
});

export async function PATCH(req: NextRequest) {
  const session = await getCustomerSession();
  if (!session) {
    return NextResponse.json({ error: "Неоторизиран достъп" }, { status: 401 });
  }
  const json = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Невалидни данни" }, { status: 400 });
  }
  await updateCustomer(session.customerId, parsed.data);
  return NextResponse.json({ ok: true, customer: await getCustomerPublic(session.customerId) });
}
