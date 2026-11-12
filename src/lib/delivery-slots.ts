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

function closingMinutes(closingTime: string): number {
  const m = toMinutes(closingTime);
  return m === 0 ? 24 * 60 : m;
}

export function isShopOpenNow(now: Date, openingTime: string, closingTime: string): boolean {
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return nowMinutes >= toMinutes(openingTime) && nowMinutes < closingMinutes(closingTime);
}

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

export function formatRequestedTime(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}:\d{2})$/.exec(value);
  if (!match) return value;
  const [, y, m, d, time] = match;
  return `${d}.${m}.${y}, ${time} ч.`;
}
