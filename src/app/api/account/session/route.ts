import { NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/auth";
import { getCustomerPublic, listAddresses } from "@/lib/repos/customers";

export async function GET() {
  const session = await getCustomerSession();
  if (!session) {
    return NextResponse.json({ loggedIn: false });
  }
  const customer = await getCustomerPublic(session.customerId);
  if (!customer) {
    return NextResponse.json({ loggedIn: false });
  }
  const addresses = await listAddresses(customer.id);
  return NextResponse.json({ loggedIn: true, customer, addresses });
}
