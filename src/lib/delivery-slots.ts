export type DeliverySlot = {
  date: string;
  time: string;
  label: string;
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

export const SHOP_TZ = "Europe/Sofia";

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

const clockFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: SHOP_TZ,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  weekday: "short",
});

// The server (Vercel) runs in UTC, so Date#getHours() would be 2-3 hours behind
// Bulgaria. Always read the wall clock in the shop's timezone instead.
export function shopClock(d: Date): { dateKey: string; minutes: number; weekday: number } {
  const p: Record<string, string> = {};
  for (const part of clockFormatter.formatToParts(d)) p[part.type] = part.value;
  const hour = parseInt(p.hour, 10) % 24;
  return {
    dateKey: `${p.year}-${p.month}-${p.day}`,
    minutes: hour * 60 + parseInt(p.minute, 10),
    weekday: WEEKDAYS[p.weekday] ?? 0,
  };
}

function addDaysToKey(key: string, n: number): string {
  const [y, m, d] = key.split("-").map((x) => parseInt(x, 10));
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

function closingMinutes(closingTime: string): number {
  const m = toMinutes(closingTime);
  return m === 0 ? 24 * 60 : m;
}

export function isShopOpenNow(now: Date, openingTime: string, closingTime: string): boolean {
  const nowMinutes = shopClock(now).minutes;
  return nowMinutes >= toMinutes(openingTime) && nowMinutes < closingMinutes(closingTime);
}

export function generateDeliverySlots(
  now: Date,
  openingTime: string,
  closingTime: string,
  locale: "bg" | "en" = "bg"
): DeliverySlot[] {
  const clock = shopClock(now);
  const nowMinutes = clock.minutes;
  const open = toMinutes(openingTime);
  const close = closingMinutes(closingTime);

  let start = Math.floor(nowMinutes / 5) * 5 + 5;
  let key = clock.dateKey;
  if (start >= close) {
    key = addDaysToKey(clock.dateKey, 1);
    start = open;
  } else if (start < open) {
    start = open;
  }

  const isToday = key === clock.dateKey;
  const dayLabel =
    locale === "en" ? (isToday ? "Today" : "Tomorrow") : isToday ? "Днес" : "Утре";

  const slots: DeliverySlot[] = [];
  for (let t = start; t < close; t += 5) {
    const time = formatMinutes(t);
    slots.push({ date: key, time, label: locale === "en" ? `${dayLabel}, ${time}` : `${dayLabel}, ${time} ч.` });
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

export function formatRequestedTime(value: string, locale: "bg" | "en" = "bg"): string {
  const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}:\d{2})$/.exec(value);
  if (!match) return value;
  const [, y, m, d, time] = match;
  return locale === "en" ? `${d}.${m}.${y}, ${time}` : `${d}.${m}.${y}, ${time} ч.`;
}
