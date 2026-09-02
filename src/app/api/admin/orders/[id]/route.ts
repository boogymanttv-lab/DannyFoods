import { NextRequest, NextResponse } from "next/server";
import {
  getOrder,
  updateOrderStatus,
  assignCourierByAdmin,
  updateOrderEstimate,
  setStationReady,
  setStationPrep,
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

// A station-restricted employee (pizza-only or everything-but-pizza) can
// accept an incoming order — move it to "new" (re-affirming it's been seen)
// or "confirmed" — but not push it further into the delivery pipeline
// (preparing/delivering/delivered/cancelled), assign a courier, or override
// the delivery-time estimate. Those stay owner/"Всичко"-only, same as
// before; only the "accept" step was reopened to station staff.
const STAFF_ALLOWED_STATUSES: OrderStatus[] = ["new", "confirmed"];

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

  const session = await getSession();
  const station = session?.station ?? "all";

  // Courier assignment and the manual delivery-time override concern the
  // WHOLE order (one delivery, one courier) — owner/"Всичко" only.
  if (body?.courier_id !== undefined || body?.estimated_delivery !== undefined) {
    if (station !== "all") {
      return NextResponse.json({ error: "Неоторизиран достъп" }, { status: 403 });
    }
  }

  if (body?.status !== undefined) {
    const status = body.status as OrderStatus;
    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: "Невалиден статус" }, { status: 400 });
    }
    if (station !== "all" && !STAFF_ALLOWED_STATUSES.includes(status)) {
      return NextResponse.json({ error: "Неоторизиран достъп" }, { status: 403 });
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

  // Each station's own self-picked prep-time estimate — internal-only, so
  // the other station (and the owner) can see a rough countdown of how much
  // longer this part will take. Same per-station permission pattern as the
  // ready toggle above; blocked once that station is already marked ready
  // (nothing left to time).
  if (body?.station_pizza_prep_estimate !== undefined || body?.station_other_prep_estimate !== undefined) {
    if (body.station_pizza_prep_estimate !== undefined) {
      if (station !== "all" && station !== "pizza") {
        return NextResponse.json({ error: "Неоторизиран достъп" }, { status: 403 });
      }
      if (order.station_pizza_ready) {
        return NextResponse.json({ error: "Пицата вече е отбелязана като готова" }, { status: 400 });
      }
      const estimate = body.station_pizza_prep_estimate;
      if (!DELIVERY_ESTIMATE_OPTIONS.includes(estimate)) {
        return NextResponse.json({ error: "Невалидно време" }, { status: 400 });
      }
      await setStationPrep(order.id, "pizza", estimate);
    }
    if (body.station_other_prep_estimate !== undefined) {
      if (station !== "all" && station !== "other") {
        return NextResponse.json({ error: "Неоторизиран достъп" }, { status: 403 });
      }
      if (order.station_other_ready) {
        return NextResponse.json({ error: "Останалото вече е отбелязано като готово" }, { status: 400 });
      }
      const estimate = body.station_other_prep_estimate;
      if (!DELIVERY_ESTIMATE_OPTIONS.includes(estimate)) {
        return NextResponse.json({ error: "Невалидно време" }, { status: 400 });
      }
      await setStationPrep(order.id, "other", estimate);
    }
  }

  return NextResponse.json({ ok: true });
}
