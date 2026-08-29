import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCustomerSession } from "@/lib/auth";
import { listAddresses, createAddress } from "@/lib/repos/customers";

const schema = z.object({
  label: z.string().min(1).max(60),
  zone_id: z.number().int().positive().nullable().optional(),
  quarter: z.string().max(100).optional(),
  street: z.string().min(2).max(150),
  house_number: z.string().min(1).max(20),
  intercom: z.string().max(60).optional(),
  address_notes: z.string().max(300).optional(),
  is_default: z.boolean().optional(),
});

export async function GET() {
  const session = await getCustomerSession();
  if (!session) {
    return NextResponse.json({ error: "Неоторизиран достъп" }, { status: 401 });
  }
  return NextResponse.json({ addresses: await listAddresses(session.customerId) });
}

export async function POST(req: NextRequest) {
  const session = await getCustomerSession();
  if (!session) {
    return NextResponse.json({ error: "Неоторизиран достъп" }, { status: 401 });
  }
  const json = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Невалидни данни за адреса" }, { status: 400 });
  }
  const address = `${parsed.data.street.trim()} ${parsed.data.house_number.trim()}`.trim();
  const id = await createAddress({
    customer_id: session.customerId,
    ...parsed.data,
    zone_id: parsed.data.zone_id ?? null,
    address,
  });
  return NextResponse.json({ ok: true, id });
}
