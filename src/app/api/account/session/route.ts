import { NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/auth";
import { getCustomerPublic, listAddresses } from "@/lib/repos/customers";

// Public on purpose (see proxy.ts) — guests hit this too (e.g. from the
// checkout page) and just get { loggedIn: false } back.
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
