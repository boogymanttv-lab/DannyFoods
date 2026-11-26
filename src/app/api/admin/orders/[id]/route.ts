import { NextRequest, NextResponse, after } from "next/server";
import { notifyCouriersForOrder } from "@/lib/push";
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

  if (body?.station_pizza_prep_estimate !== undefined || body?.station_other_prep_estimate !== undefined) {
    let pizzaEstimate = order.station_pizza_prep_estimate;
    let otherEstimate = order.station_other_prep_estimate;

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
      pizzaEstimate = estimate;
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
      otherEstimate = estimate;
    }

    const relevantEstimates = [pizzaEstimate, otherEstimate].filter(
      (e): e is (typeof DELIVERY_ESTIMATE_OPTIONS)[number] => e != null
    );
    if (relevantEstimates.length > 0) {
      await updateOrderEstimate(order.id, combineEstimates(...relevantEstimates));
    }
  }

  // Kitchen accepted the order or a courier was (re)assigned → push
  // notification to the courier(s). Runs after the response is sent, so
  // the kitchen's button reacts instantly.
  if (body?.status !== undefined || body?.courier_id !== undefined) {
    after(() => notifyCouriersForOrder(order.id));
  }

  return NextResponse.json({ ok: true });
}
