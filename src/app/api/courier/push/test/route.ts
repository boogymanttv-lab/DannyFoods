import { NextResponse } from "next/server";
import { getCourierSession } from "@/lib/auth";
import { sendToSubscriptions } from "@/lib/push";
import { listSubscriptionsForCourier } from "@/lib/repos/push";

export const dynamic = "force-dynamic";

// "Изпрати тестово известие" button in the courier panel.
export async function POST() {
  const session = await getCourierSession();
  if (!session) return NextResponse.json({ error: "Неоторизиран достъп" }, { status: 401 });
  const subs = await listSubscriptionsForCourier(session.courierId);
  if (subs.length === 0) {
    return NextResponse.json({ error: "Известията не са включени на това устройство." }, { status: 400 });
  }
  const result = await sendToSubscriptions(subs, {
    title: "✅ Известията работят",
    body: "Така ще изглежда известие за нова поръчка.",
    url: "/courier",
    tag: "test",
  });
  if (result.sent === 0) {
    return NextResponse.json({ error: "Известието не можа да бъде изпратено. Включи ги отново." }, { status: 502 });
  }
  return NextResponse.json({ ok: true, ...result });
}
