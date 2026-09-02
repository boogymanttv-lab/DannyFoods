import { NextRequest, NextResponse } from "next/server";
import { getOrderByNumber } from "@/lib/repos/orders";
import { getCourier } from "@/lib/repos/couriers";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  const { orderNumber } = await params;
  const order = await getOrderByNumber(orderNumber);
  if (!order) {
    return NextResponse.json({ error: "Поръчката не е намерена" }, { status: 404 });
  }

  // No more lazy "has the requested time arrived yet" activation here — the
  // estimate is only ever set once staff actually acts on the order (the
  // first status change, see the admin PATCH handler), whether the order is
  // ASAP or scheduled for later. Until then the client shows a static
  // "waiting for confirmation" ring, or — for a scheduled order — a
  // countdown to the requested time (see OrderTracking.tsx).

  // Only reveal the courier's live position while the order is actively
  // out for delivery — never after delivery, never for other orders.
  let courierLocation: { lat: number; lng: number; name: string } | null = null;
  if (order.status === "delivering" && order.courier_id) {
    const courier = await getCourier(order.courier_id);
    if (courier && courier.last_lat != null && courier.last_lng != null) {
      courierLocation = { lat: courier.last_lat, lng: courier.last_lng, name: courier.name };
    }
  }

  const destination =
    order.dest_lat != null && order.dest_lng != null
      ? { lat: order.dest_lat, lng: order.dest_lng }
      : null;

  return NextResponse.json({
    status: order.status,
    courierLocation,
    destination,
    estimatedDelivery: order.estimated_delivery,
    estimatedDeliverySetAt: order.estimated_delivery_set_at,
    requestedTime: order.requested_time,
  });
}
