import { NextRequest, NextResponse } from "next/server";
import {
  assignCourierByAdmin,
  countActiveOrders,
  deleteOrders,
  getOrder,
  updateOrderEstimate,
  updateOrderStatus,
} from "@/lib/repos/orders";
import { combineEstimates, parseBusyHours, suggestByLoad, suggestEstimate } from "@/lib/delivery-estimate";
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
const MAX_IDS = 200;

function parseIds(value: unknown): number[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_IDS) return null;
  const ids = value.map((v) => Number(v));
  if (ids.some((n) => !Number.isInteger(n) || n <= 0)) return null;
  return Array.from(new Set(ids));
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const ids = parseIds(body?.ids);
  if (!ids) {
    return NextResponse.json({ error: "Не са избрани поръчки" }, { status: 400 });
  }

  const session = await getSession();
  const station = session?.station ?? "all";

  if (body.courier_id !== undefined && station !== "all") {
    return NextResponse.json({ error: "Неоторизиран достъп" }, { status: 403 });
  }

  let status: OrderStatus | undefined;
  if (body.status !== undefined) {
    status = body.status as OrderStatus;
    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: "Невалиден статус" }, { status: 400 });
    }
    if (station !== "all" && !STAFF_ALLOWED_STATUSES.includes(status)) {
      return NextResponse.json({ error: "Неоторизиран достъп" }, { status: 403 });
    }
  }

  if (status === undefined && body.courier_id === undefined) {
    return NextResponse.json({ error: "Няма избрано действие" }, { status: 400 });
  }

  let autoEstimate: ReturnType<typeof combineEstimates> | null = null;
  if (status !== undefined) {
    const settings = await getSettings();
    autoEstimate = combineEstimates(
      suggestEstimate(parseBusyHours(settings.busy_hours_json)),
      suggestByLoad(await countActiveOrders())
    );
  }

  let updated = 0;
  for (const id of ids) {
    const order = await getOrder(id);
    if (!order) continue;
    if (status !== undefined) {
      await updateOrderStatus(order.id, status);
      if (!order.estimated_delivery && autoEstimate) {
        await updateOrderEstimate(order.id, autoEstimate);
      }
    }
    if (body.courier_id !== undefined) {
      await assignCourierByAdmin(order.id, body.courier_id === null ? null : Number(body.courier_id));
    }
    updated += 1;
  }

  return NextResponse.json({ ok: true, updated });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  const station = session?.station ?? "all";
  if (station !== "all") {
    return NextResponse.json({ error: "Неоторизиран достъп" }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const ids = parseIds(body?.ids);
  if (!ids) {
    return NextResponse.json({ error: "Не са избрани поръчки" }, { status: 400 });
  }
  const deleted = await deleteOrders(ids);
  return NextResponse.json({ ok: true, deleted });
}
