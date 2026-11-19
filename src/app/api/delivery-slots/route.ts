import { NextResponse } from "next/server";
import { getSettings } from "@/lib/repos/settings";
import { generateDeliverySlots, isShopOpenNow } from "@/lib/delivery-slots";
import { getLocale } from "@/lib/i18n/locale";
import { translateOne } from "@/lib/i18n/auto";

export async function GET() {
  const settings = await getSettings();
  const locale = await getLocale();
  const now = new Date();
  const slots = generateDeliverySlots(now, settings.opening_time, settings.closing_time, locale);
  return NextResponse.json({
    slots,
    isOpenNow: isShopOpenNow(now, settings.opening_time, settings.closing_time),
    openingTime: settings.opening_time,
    closingTime: settings.closing_time,
    deliveryFeeFlat: Number(settings.delivery_fee_flat || "0"),
    freeDeliveryOver: Number(settings.free_delivery_over || "0"),
    minOrderGlobal: Number(settings.min_order_global || "0"),
    pickupAddress: await translateOne(settings.address, locale),
  });
}
