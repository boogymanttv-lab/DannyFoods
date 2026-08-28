// Generates the list of selectable delivery time slots for "schedule for
// later" checkout — 5-minute increments from the next available moment
// through closing time, rolling over to tomorrow once today has none left.
// Pure functions (no DB access) so this can be imported from a client
// component (the checkout page) as well as the server-side order API route,
// which recomputes the same list to validate whatever the client submitted.

export type DeliverySlot = {
  // "YYYY-MM-DD", in the server's local calendar day — paired with `time`
  // this uniquely identifies a slot even across a midnight rollover, so
  // "09:15" tonight and "09:15" tomorrow are never confused with each other.
  date: string;
  time: string; // "HH:MM"
  label: string; // e.g. "Днес, 09:15 ч." / "Утре, 09:15 ч."
};

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((n) => parseInt(n, 10) || 0);
  return h * 60 + m;
}

function formatMinutes(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

// "00:00" as a closing time means "open until midnight" (end of day), i.e.
// effectively minute 1440 for the purposes of generating same-day slots.
function closingMinutes(closingTime: string): number {
  const m = toMinutes(closingTime);
  return m === 0 ? 24 * 60 : m;
}

// Whether the shop is open for business *right now* — used to decide
// whether "Възможно най-скоро" (ASAP) may be selected at all.
export function isShopOpenNow(now: Date, openingTime: string, closingTime: string): boolean {
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return nowMinutes >= toMinutes(openingTime) && nowMinutes < closingMinutes(closingTime);
}

// Returns the available slots ("HH:MM", 5-minute steps, each tagged with its
// calendar date) starting at the next 5-minute mark after `now` (so at 10:10
// the first option is 10:15) through closing time. If today has no slots
// left (already past closing, or too close to it), rolls over to tomorrow's
// full opening-to-closing window instead of returning nothing.
export function generateDeliverySlots(
  now: Date,
  openingTime: string,
  closingTime: string
): DeliverySlot[] {
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const open = toMinutes(openingTime);
  const close = closingMinutes(closingTime);

  let start = Math.floor(nowMinutes / 5) * 5 + 5;
  let targetDate = now;
  if (start >= close) {
    targetDate = addDays(now, 1);
    start = open;
  } else if (start < open) {
    start = open;
  }

  const isToday = dateKey(targetDate) === dateKey(now);
  const dayLabel = isToday ? "Днес" : "Утре";
  const key = dateKey(targetDate);

  const slots: DeliverySlot[] = [];
  for (let t = start; t < close; t += 5) {
    const time = formatMinutes(t);
    slots.push({ date: key, time, label: `${dayLabel}, ${time} ч.` });
  }
  return slots;
}

export function isValidDeliverySlot(
  date: string,
  time: string,
  now: Date,
  openingTime: string,
  closingTime: string
): boolean {
  return generateDeliverySlots(now, openingTime, closingTime).some(
    (s) => s.date === date && s.time === time
  );
}

// Formats a stored "YYYY-MM-DD HH:MM" requested_time value for display,
// e.g. "28.08.2026, 14:30 ч." Falls back to the raw value if it's not in
// the expected shape (defensive — should never happen for values this app
// wrote itself).
export function formatRequestedTime(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}:\d{2})$/.exec(value);
  if (!match) return value;
  const [, y, m, d, time] = match;
  return `${d}.${m}.${y}, ${time} ч.`;
}
