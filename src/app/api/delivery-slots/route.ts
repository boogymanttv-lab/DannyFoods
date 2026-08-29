import { NextResponse } from "next/server";
import { getSettings } from "@/lib/repos/settings";
import { generateDeliverySlots, isShopOpenNow } from "@/lib/delivery-slots";

// Public — used by the checkout page to offer "schedule for later" delivery
// times. Computed from the server's clock so it always matches what the
// order API will accept.
export async function GET() {
  const settings = await getSettings();
  const now = new Date();
  const slots = generateDeliverySlots(now, settings.opening_time, settings.closing_time);
  return NextResponse.json({
    slots,
    isOpenNow: isShopOpenNow(now, settings.opening_time, settings.closing_time),
    openingTime: settings.opening_time,
    closingTime: settings.closing_time,
    // Flat checkout pricing rules — also exposed here so the checkout page
    // doesn't need a second round-trip just for these three numbers.
    deliveryFeeFlat: Number(settings.delivery_fee_flat || "0"),
    freeDeliveryOver: Number(settings.free_delivery_over || "0"),
    minOrderGlobal: Number(settings.min_order_global || "0"),
    pickupAddress: settings.address,
  });
}
