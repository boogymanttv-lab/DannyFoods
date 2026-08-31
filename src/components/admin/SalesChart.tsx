"use client";

import { useMemo, useState } from "react";
import { formatPrice } from "@/lib/format";

type DayPoint = { date: string; orders: number; revenue: number };

function dayLabel(iso: string) {
  const d = new Date(iso + "T00:00:00Z");
  return `${d.getUTCDate()}.${d.getUTCMonth() + 1}`;
}

// Groups the daily series into ISO-ish weeks (Monday-start, chunked from the
// oldest day forward) for the "По седмици" view — each bucket just labeled
// by its first day, since a full date range would crowd the axis.
function toWeeks(days: DayPoint[]): { label: string; orders: number; revenue: number }[] {
  const weeks: { label: string; orders: number; revenue: number }[] = [];
  for (let i = 0; i < days.length; i += 7) {
    const chunk = days.slice(i, i + 7);
    weeks.push({
      label: dayLabel(chunk[0].date),
      orders: chunk.reduce((s, d) => s + d.orders, 0),
      revenue: chunk.reduce((s, d) => s + d.revenue, 0),
    });
  }
  return weeks;
}

// Simple, dependency-free bar chart (inline SVG) — no charting library
// needed for a single admin widget. Revenue drives bar height; order count
// shows in the tooltip-like label under the x-axis on hover isn't needed
// here since both figures fit directly above/below each bar at this scale.
export function SalesChart({ series }: { series: DayPoint[] }) {
  const [range, setRange] = useState<7 | 14 | 30>(14);
  const [grouping, setGrouping] = useState<"day" | "week">("day");
  const [hover, setHover] = useState<number | null>(null);

  const windowed = useMemo(() => series.slice(series.length - range), [series, range]);
  const points = useMemo(
    () =>
      grouping === "day"
        ? windowed.map((d) => ({ label: dayLabel(d.date), orders: d.orders, revenue: d.revenue }))
        : toWeeks(windowed),
    [windowed, grouping]
  );

  const maxRevenue = Math.max(1, ...points.map((p) => p.revenue));
  const totalRevenue = points.reduce((s, p) => s + p.revenue, 0);
  const totalOrders = points.reduce((s, p) => s + p.orders, 0);

  const chartHeight = 160;

  return (
    <div className="bg-surface rounded-2xl border border-border p-5">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-1">
        <h2 className="font-semibold">Продажби</h2>
        <div className="flex items-center gap-1.5 flex-wrap">
          {([7, 14, 30] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`text-xs font-semibold px-2.5 py-1 rounded-full border transition-colors ${
                range === r ? "bg-brand text-white border-brand" : "border-border text-muted"
              }`}
            >
              {r} дни
            </button>
          ))}
          <span className="w-px h-4 bg-border mx-1" />
          {(["day", "week"] as const).map((g) => (
            <button
              key={g}
              onClick={() => setGrouping(g)}
              className={`text-xs font-semibold px-2.5 py-1 rounded-full border transition-colors ${
                grouping === g ? "bg-brand text-white border-brand" : "border-border text-muted"
              }`}
            >
              {g === "day" ? "По дни" : "По седмици"}
            </button>
          ))}
        </div>
      </div>
      <p className="text-sm text-muted mb-4">
        {formatPrice(totalRevenue)} общо приход · {totalOrders} поръчки
      </p>

      <div className="flex items-end gap-1.5" style={{ height: chartHeight }}>
        {points.map((p, i) => {
          const h = Math.max(3, (p.revenue / maxRevenue) * (chartHeight - 28));
          const isHover = hover === i;
          return (
            <div
              key={i}
              className="relative flex-1 flex flex-col items-center justify-end h-full group"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              {isHover && (
                <div className="absolute -top-1 -translate-y-full bg-foreground text-background text-[11px] font-semibold px-2 py-1 rounded-lg whitespace-nowrap z-10 shadow-lg">
                  {formatPrice(p.revenue)} · {p.orders} поръчки
                </div>
              )}
              <div
                className={`w-full rounded-t-md transition-colors ${
                  isHover ? "bg-brand-dark" : "bg-brand/80"
                }`}
                style={{ height: h }}
              />
              <span className="text-[10px] text-muted mt-1.5 whitespace-nowrap">{p.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
