import { NextRequest, NextResponse } from "next/server";
import { errJson } from "@/lib/i18n/api";
import { getOrderByNumber } from "@/lib/repos/orders";
import { getCourier } from "@/lib/repos/couriers";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  const { orderNumber } = await params;
  const order = await getOrderByNumber(orderNumber);
  if (!order) {
    return await errJson("Поръчката не е намерена", 404);
  }

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
