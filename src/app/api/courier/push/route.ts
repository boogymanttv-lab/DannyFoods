import { NextRequest, NextResponse } from "next/server";
import { getCourierSession } from "@/lib/auth";
import { vapidPublicKey } from "@/lib/push";
import {
  deletePushSubscription,
  hasPushSubscription,
  savePushSubscription,
} from "@/lib/repos/push";

export const dynamic = "force-dynamic";

// GET ?endpoint=... → the public key the phone needs to subscribe, and
// whether this exact phone is already registered for this courier.
export async function GET(req: NextRequest) {
  const session = await getCourierSession();
  if (!session) return NextResponse.json({ error: "Неоторизиран достъп" }, { status: 401 });
  const endpoint = req.nextUrl.searchParams.get("endpoint");
  const publicKey = vapidPublicKey();
  return NextResponse.json({
    publicKey,
    configured: Boolean(publicKey && process.env.VAPID_PRIVATE_KEY),
    subscribed: endpoint ? await hasPushSubscription(session.courierId, endpoint) : false,
  });
}

export async function POST(req: NextRequest) {
  const session = await getCourierSession();
  if (!session) return NextResponse.json({ error: "Неоторизиран достъп" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const endpoint = typeof body?.endpoint === "string" ? body.endpoint : "";
  const p256dh = typeof body?.keys?.p256dh === "string" ? body.keys.p256dh : "";
  const auth = typeof body?.keys?.auth === "string" ? body.keys.auth : "";
  if (!/^https:\/\//.test(endpoint) || !p256dh || !auth || endpoint.length > 2000) {
    return NextResponse.json({ error: "Невалиден абонамент" }, { status: 400 });
  }
  const ua = (req.headers.get("user-agent") ?? "").slice(0, 300);
  await savePushSubscription(session.courierId, { endpoint, p256dh, auth }, ua);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const session = await getCourierSession();
  if (!session) return NextResponse.json({ error: "Неоторизиран достъп" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const endpoint = typeof body?.endpoint === "string" ? body.endpoint : "";
  if (endpoint) await deletePushSubscription(session.courierId, endpoint);
  return NextResponse.json({ ok: true });
}
