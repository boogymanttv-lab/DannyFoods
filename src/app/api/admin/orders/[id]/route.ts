import { NextRequest, NextResponse } from "next/server";
import {
  getOrder,
  updateOrderStatus,
  assignCourierByAdmin,
  updateOrderEstimate,
  setStationReady,
} from "@/lib/repos/orders";
import { DELIVERY_ESTIMATE_OPTIONS } from "@/lib/delivery-estimate";
import { getSession } from "@/lib/auth";
import type { OrderStatus } from "@/lib/types";

const VALID_STATUSES: OrderStatus[] = [
  "new",
  "confirmed",
  "preparing",
  "delivering",
  "delivered",
  "cancelled",
];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const order = await getOrder(Number(id));
  if (!order) {
    return NextResponse.json({ error: "Поръчката не е намерена" }, { status: 404 });
  }

  if (body?.status !== undefined) {
    const status = body.status as OrderStatus;
    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: "Невалиден статус" }, { status: 400 });
    }
    await updateOrderStatus(order.id, status);
  }

  if (body?.courier_id !== undefined) {
    await assignCourierByAdmin(order.id, body.courier_id === null ? null : Number(body.courier_id));
  }

  if (body?.estimated_delivery !== undefined) {
    const estimate = body.estimated_delivery;
    if (estimate !== null && !DELIVERY_ESTIMATE_OPTIONS.includes(estimate)) {
      return NextResponse.json({ error: "Невалидно време за доставка" }, { status: 400 });
    }
    await updateOrderEstimate(order.id, estimate);
  }

  // Per-kitchen-station prep flags — a station-restricted employee can only
  // mark their OWN station's part ready (an 'all'-station account, which
  // includes every owner-level session, can mark either).
  if (body?.station_pizza_ready !== undefined || body?.station_other_ready !== undefined) {
    const session = await getSession();
    const station = session?.station ?? "all";
    if (body.station_pizza_ready !== undefined) {
      if (station !== "all" && station !== "pizza") {
        return NextResponse.json({ error: "Неоторизиран достъп" }, { status: 403 });
      }
      await setStationReady(order.id, "pizza", Boolean(body.station_pizza_ready));
    }
    if (body.station_other_ready !== undefined) {
      if (station !== "all" && station !== "other") {
        return NextResponse.json({ error: "Неоторизиран достъп" }, { status: 403 });
      }
      await setStationReady(order.id, "other", Boolean(body.station_other_ready));
    }
  }

  return NextResponse.json({ ok: true });
}
