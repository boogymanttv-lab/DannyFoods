import { NextRequest, NextResponse } from "next/server";
import { getOrderByNumber, countActiveOrders, updateOrderEstimate } from "@/lib/repos/orders";
import { getCourier } from "@/lib/repos/couriers";
import { getSettings } from "@/lib/repos/settings";
import { combineEstimates, parseBusyHours, suggestByLoad, suggestEstimate } from "@/lib/delivery-estimate";

// A scheduled ("for later") order is created with no estimate at all (see
// /api/orders) — this parses its requested_time the same way the rest of
// the app does (plain "YYYY-MM-DD HH:MM" components, no timezone math;
// consistent with isValidDeliverySlot/delivery-slots.ts) and reports
// whether that moment has actually arrived yet.
function requestedTimeHasArrived(requestedTime: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(requestedTime);
  if (!match) return true;
  const [, y, mo, d, hh, mm] = match;
  const deadline = new Date(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(hh),
    Number(mm)
  ).getTime();
  return Date.now() >= deadline;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  const { orderNumber } = await params;
  let order = await getOrderByNumber(orderNumber);
  if (!order) {
    return NextResponse.json({ error: "Поръчката не е намерена" }, { status: 404 });
  }

  // Lazily activate the real prep-time estimate the moment a scheduled
  // order's requested time arrives — until then the client shows a
  // countdown to that time instead of a prep-time ring (see
  // ScheduledTimeCountdown in OrderTracking.tsx).
  if (!order.estimated_delivery && order.requested_time && requestedTimeHasArrived(order.requested_time)) {
    const settings = await getSettings();
    const busyRules = parseBusyHours(settings.busy_hours_json);
    const autoEstimate = combineEstimates(
      suggestEstimate(busyRules),
      suggestByLoad(await countActiveOrders())
    );
    await updateOrderEstimate(order.id, autoEstimate);
    order = (await getOrderByNumber(orderNumber))!;
  }

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
