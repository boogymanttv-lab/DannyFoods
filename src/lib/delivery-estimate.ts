// Shared delivery-time-estimate logic used by both the admin panel (to
// suggest/set an estimate on an order) and the customer-facing tracking
// view (to display it). Pure functions only — no DB access — so this can
// be imported from client components too.

export const DELIVERY_ESTIMATE_OPTIONS = ["15-20", "20-30", "30-40", "40-60"] as const;
export type DeliveryEstimate = (typeof DELIVERY_ESTIMATE_OPTIONS)[number];

export function estimateLabel(estimate: string, locale: "bg" | "en" = "bg"): string {
  return locale === "en" ? `${estimate} min` : `${estimate} мин`;
}

// Highest minute in an estimate range ("20-30" -> 30) — used as the
// countdown deadline (created/estimate-set time + this many minutes).
export function estimateUpperMinutes(estimate: string): number {
  const parts = estimate.split("-").map((n) => parseInt(n, 10));
  return parts[1] ?? parts[0] ?? 30;
}

const ESTIMATE_RANK: Record<DeliveryEstimate, number> = {
  "15-20": 0,
  "20-30": 1,
  "30-40": 2,
  "40-60": 3,
};

// Picks the "worse" (longer) of several suggested estimates — used to
// combine the time-of-day (busy hours) suggestion with the current-load
// suggestion, so whichever signal says things are busier wins.
export function combineEstimates(...estimates: DeliveryEstimate[]): DeliveryEstimate {
  return estimates.reduce((worst, e) => (ESTIMATE_RANK[e] > ESTIMATE_RANK[worst] ? e : worst));
}

// Based on how many orders are currently active (not yet delivered or
// cancelled) — more orders in the pipeline means longer real-world
// delivery times, regardless of time of day.
export function suggestByLoad(activeOrderCount: number): DeliveryEstimate {
  if (activeOrderCount >= 20) return "40-60";
  if (activeOrderCount >= 15) return "30-40";
  if (activeOrderCount >= 5) return "20-30";
  return "15-20";
}

// A "busy hours" rule: on any of `days` (0 = Неделя ... 6 = Събота, matching
// JS Date#getDay()), between `start` and `end` ("HH:MM", end exclusive),
// the delivery time estimate should default to the busier option.
export type BusyHourRule = {
  id: string;
  label: string;
  days: number[];
  start: string;
  end: string;
};

export const DAY_LABELS = ["Нед", "Пон", "Вт", "Ср", "Чет", "Пет", "Съб"];

export const DEFAULT_BUSY_HOURS: BusyHourRule[] = [
  {
    id: "daily-peak",
    label: "Пиково време (всеки ден)",
    days: [0, 1, 2, 3, 4, 5, 6],
    start: "16:00",
    end: "18:00",
  },
  {
    id: "weekend-night",
    label: "Петък / Събота / Неделя вечер",
    days: [0, 5, 6],
    start: "21:00",
    end: "22:00",
  },
];

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((n) => parseInt(n, 10) || 0);
  return h * 60 + m;
}

export function isBusyAt(rules: BusyHourRule[], date: Date): boolean {
  const day = date.getDay();
  const minutes = date.getHours() * 60 + date.getMinutes();
  return rules.some((r) => {
    if (!r.days.includes(day)) return false;
    return minutes >= toMinutes(r.start) && minutes < toMinutes(r.end);
  });
}

export function suggestEstimate(rules: BusyHourRule[], date: Date = new Date()): DeliveryEstimate {
  return isBusyAt(rules, date) ? "20-30" : "15-20";
}

export function parseBusyHours(json: string | undefined | null): BusyHourRule[] {
  if (!json) return DEFAULT_BUSY_HOURS;
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed as BusyHourRule[];
  } catch {
    // fall through to default
  }
  return DEFAULT_BUSY_HOURS;
}

export type KitchenLoadTier = "calm" | "medium" | "busy";

// Turns the same combined estimate that already drives an order's
// delivery-time countdown into a plain-language "how busy is the kitchen
// right now" signal for the homepage — no separate threshold config to
// maintain, no new admin settings: whatever estimate a customer would get
// right now IS the signal. Deliberately just 3 tiers (not the 4 estimate
// bands) since "20-30 vs 30-40" isn't a meaningfully different customer
// message — both just mean "busier than usual".
export function kitchenLoadLevel(estimate: DeliveryEstimate): {
  tier: KitchenLoadTier;
  label: string;
} {
  switch (estimate) {
    case "15-20":
      return { tier: "calm", label: "Кухнята работи спокойно" };
    case "20-30":
      return { tier: "medium", label: "Леко натоварени сме" };
    default:
      return { tier: "busy", label: "Много поръчки в момента" };
  }
}
