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

// Public — powers the homepage's live "how busy is the kitchen right now"
// badge (see KitchenStatusBadge.tsx). Polled client-side every ~60s so the
// signal stays current while someone browses, without a full page reload.
// Uses exactly the same combined estimate (busy-hours + current active
// order count) that a real order placed right now would be assigned —
// there's no separate "load" concept to keep in sync with the real one.
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
