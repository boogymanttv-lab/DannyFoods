import { NextRequest, NextResponse } from "next/server";
import {
  getOrder,
  updateOrderStatus,
  assignCourierByAdmin,
  updateOrderEstimate,
  setStationReady,
  countActiveOrders,
} from "@/lib/repos/orders";
import {
  DELIVERY_ESTIMATE_OPTIONS,
  combineEstimates,
  parseBusyHours,
  suggestByLoad,
  suggestEstimate,
} from "@/lib/delivery-estimate";
import { getSettings } from "@/lib/repos/settings";
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

  // Status, courier assignment and the manual delivery-time override all
  // concern the WHOLE order (one delivery, one customer, one courier) —
  // a station-restricted employee (pizza-only or everything-but-pizza) only
  // ever touches their own "Готовност по станция" toggle below, never these.
  // Without this check, a pizza-station employee moving the order to e.g.
  // "Приготвя се" would silently change what the doner-station employee
  // sees too, even though the two answer for separate parts of the kitchen.
  if (body?.status !== undefined || body?.courier_id !== undefined || body?.estimated_delivery !== undefined) {
    const session = await getSession();
    const station = session?.station ?? "all";
    if (station !== "all") {
      return NextResponse.json({ error: "Неоторизиран достъп" }, { status: 403 });
    }
  }

  if (body?.status !== undefined) {
    const status = body.status as OrderStatus;
    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: "Невалиден статус" }, { status: 400 });
    }
    await updateOrderStatus(order.id, status);

    // The delivery-time countdown only ever starts from an explicit staff
    // action — the very first status change on this order — rather than
    // the moment the order was placed. Covers both ASAP orders (previously
    // got an immediate, possibly premature, countdown) and scheduled ones
    // (previously activated purely by the clock, even before anyone had
    // actually looked at the order). A later manual pick via
    // `estimated_delivery` below still overrides it same as before.
    if (!order.estimated_delivery) {
      const settings = await getSettings();
      const busyRules = parseBusyHours(settings.busy_hours_json);
      const autoEstimate = combineEstimates(
        suggestEstimate(busyRules),
        suggestByLoad(await countActiveOrders())
      );
      await updateOrderEstimate(order.id, autoEstimate);
    }
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
