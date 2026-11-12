import { NextResponse } from "next/server";
import { getSettings } from "@/lib/repos/settings";
import { countActiveOrders } from "@/lib/repos/orders";
import { isShopOpenNow } from "@/lib/delivery-slots";
import {
  combineEstimates,
  estimateLabel,
  kitchenLoadLevel,
  parseBusyHours,
  suggestByLoad,
  suggestEstimate,
} from "@/lib/delivery-estimate";

export async function GET() {
  const settings = await getSettings();
  const openNow = isShopOpenNow(new Date(), settings.opening_time, settings.closing_time);
  const estimate = combineEstimates(
    suggestEstimate(parseBusyHours(settings.busy_hours_json)),
    suggestByLoad(await countActiveOrders())
  );
  const { tier, label } = kitchenLoadLevel(estimate);
  return NextResponse.json({
    openNow,
    estimate,
    estimateLabel: estimateLabel(estimate),
    tier,
    label,
  });
}
