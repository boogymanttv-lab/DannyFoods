import { NextResponse } from "next/server";
import { errJson } from "@/lib/i18n/api";
import { getCustomerSession } from "@/lib/auth";
import { listOrdersForCustomer } from "@/lib/repos/orders";

export async function GET() {
  const session = await getCustomerSession();
  if (!session) {
    return await errJson("Неоторизиран достъп", 401);
  }
  return NextResponse.json({ orders: await listOrdersForCustomer(session.customerId) });
}
