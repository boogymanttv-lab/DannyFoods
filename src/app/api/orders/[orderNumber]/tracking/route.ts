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
  });
}
