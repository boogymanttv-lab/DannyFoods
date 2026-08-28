import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCustomerSession } from "@/lib/auth";
import { updateAddress, deleteAddress } from "@/lib/repos/customers";

const schema = z.object({
  label: z.string().min(1).max(60).optional(),
  zone_id: z.number().int().positive().nullable().optional(),
  street: z.string().min(2).max(150).optional(),
  house_number: z.string().min(1).max(20).optional(),
  intercom: z.string().max(60).optional(),
  address_notes: z.string().max(300).optional(),
  is_default: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getCustomerSession();
  if (!session) {
    return NextResponse.json({ error: "Неоторизиран достъп" }, { status: 401 });
  }
  const { id } = await params;
  const json = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Невалидни данни" }, { status: 400 });
  }
  const payload: Parameters<typeof updateAddress>[2] = { ...parsed.data };
  // Keep the combined display string in sync whenever either part changes.
  if (parsed.data.street !== undefined || parsed.data.house_number !== undefined) {
    const street = parsed.data.street?.trim() ?? "";
    const houseNumber = parsed.data.house_number?.trim() ?? "";
    payload.address = `${street} ${houseNumber}`.trim();
  }
  await updateAddress(Number(id), session.customerId, payload);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getCustomerSession();
  if (!session) {
    return NextResponse.json({ error: "Неоторизиран достъп" }, { status: 401 });
  }
  const { id } = await params;
  await deleteAddress(Number(id), session.customerId);
  return NextResponse.json({ ok: true });
}
