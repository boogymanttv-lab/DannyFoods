import { NextRequest, NextResponse } from "next/server";
import {
  getOrder,
  updateOrderStatus,
  assignCourierByAdmin,
  updateOrderEstimate,
} from "@/lib/repos/orders";
import { DELIVERY_ESTIMATE_OPTIONS } from "@/lib/delivery-estimate";
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

  return NextResponse.json({ ok: true });
}
