import { NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/auth";
import { listOrdersForCustomer } from "@/lib/repos/orders";

export async function GET() {
  const session = await getCustomerSession();
  if (!session) {
    return NextResponse.json({ error: "Неоторизиран достъп" }, { status: 401 });
  }
  return NextResponse.json({ orders: await listOrdersForCustomer(session.customerId) });
}
