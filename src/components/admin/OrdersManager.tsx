"use client";

import { useEffect, useRef, useState } from "react";
import { formatPrice } from "@/lib/format";
import { formatRequestedTime } from "@/lib/delivery-slots";
import { playNewOrderChime } from "@/lib/notify-sound";
import {
  DELIVERY_ESTIMATE_OPTIONS,
  combineEstimates,
  estimateLabel,
  estimateUpperMinutes,
  parseBusyHours,
  suggestByLoad,
  suggestEstimate,
  type DeliveryEstimate,
} from "@/lib/delivery-estimate";
import type { CourierPublic, Order, OrderItem, OrderStatus } from "@/lib/types";

const STATUS_LABELS: Record<OrderStatus, string> = {
  new: "Приета",
  confirmed: "Потвърдена",
  preparing: "Приготвя се",
  delivering: "На път е",
  delivered: "Доставена",
  cancelled: "Отказана",
};

const STATUS_OPTIONS = Object.keys(STATUS_LABELS) as OrderStatus[];

// A station-restricted employee can accept an order — that's as far as
// "приемат поръчките" goes for them — but not push it further into the
// pipeline (preparing/delivering/delivered/cancelled), which stays owner-only.
const STAFF_VISIBLE_STATUSES: OrderStatus[] = ["new", "confirmed"];

// One glance at the order list should say how urgent each row is — a brand
// new, unconfirmed order (red, gently pulsing so it stands out without
// being distracting all shift) needs eyes on it now; everything after that
// just needs a distinct color per stage.
const STATUS_PILL_STYLES: Record<OrderStatus, string> = {
  new: "bg-brand/10 text-brand order-pill-pulse",
  confirmed: "bg-success/10 text-success",
  preparing: "bg-yellow-100 text-yellow-800",
  delivering: "bg-blue-100 text-blue-800",
  delivered: "bg-orange-100 text-orange-800",
  cancelled: "bg-black/5 text-muted",
};

export function OrdersManager({
  station,
}: {
  // 'all' (owners, and staff explicitly assigned "Всичко") sees every item
  // the same and can mark either station ready. 'pizza'/'other' dim the
  // items that aren't theirs and can only mark their own station ready —
  // see Настройки → Служители and the PATCH route's server-side check.
  station: "all" | "pizza" | "other";
}) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [couriers, setCouriers] = useState<CourierPublic[]>([]);
  const [filter, setFilter] = useState<OrderStatus | "">("");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeSuggestion, setTimeSuggestion] = useState<DeliveryEstimate>("15-20");
  const [loadSuggestion, setLoadSuggestion] = useState<DeliveryEstimate>("15-20");
  const suggestedEstimate = combineEstimates(timeSuggestion, loadSuggestion);
  // Tracks every order id already seen across polls (regardless of the
  // current status filter) so a genuinely new order — not just a filter
  // switch surfacing older ones — is what triggers the chime. Stays null
  // until the very first load resolves, so opening the page never plays a
  // sound for orders that were already sitting there.
  const seenOrderIdsRef = useRef<Set<number> | null>(null);

  async function load() {
    setLoading(true);
    const url = filter ? `/api/admin/orders?status=${filter}` : "/api/admin/orders";
    const res = await fetch(url);
    const data = await res.json();
    const fetched: Order[] = data.orders ?? [];
    const seen = seenOrderIdsRef.current;
    if (seen === null) {
      seenOrderIdsRef.current = new Set(fetched.map((o) => o.id));
    } else {
      const hasNewOrder = fetched.some((o) => !seen.has(o.id));
      if (hasNewOrder) playNewOrderChime();
      for (const o of fetched) seen.add(o.id);
    }
    setOrders(fetched);
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: initial fetch + polling refresh
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  useEffect(() => {
    fetch("/api/admin/couriers")
      .then((r) => r.json())
      .then((d) => setCouriers(d.couriers ?? []));
  }, []);

  // Recomputed periodically (busy-hours windows are short, e.g. 16:00-18:00,
  // and the active-order count changes as orders come in and get delivered)
  // so the suggested default for newly-opened orders stays accurate. The
  // final suggestion is whichever signal says things are busier.
  useEffect(() => {
    function refreshSuggestion() {
      fetch("/api/admin/settings")
        .then((r) => r.json())
        .then((d) => {
          const rules = parseBusyHours(d.settings?.busy_hours_json);
          setTimeSuggestion(suggestEstimate(rules));
        })
        .catch(() => {});
      fetch("/api/admin/orders/stats")
        .then((r) => r.json())
        .then((d) => setLoadSuggestion(suggestByLoad(d.activeOrders ?? 0)))
        .catch(() => {});
    }
    refreshSuggestion();
    const interval = setInterval(refreshSuggestion, 30000);
    return () => clearInterval(interval);
  }, []);

  async function changeStatus(id: number, status: OrderStatus) {
    await fetch(`/api/admin/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));
  }

  async function assignCourier(id: number, courierId: number | null) {
    await fetch(`/api/admin/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courier_id: courierId }),
    });
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, courier_id: courierId } : o)));
  }

  async function setEstimate(id: number, estimate: string) {
    await fetch(`/api/admin/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estimated_delivery: estimate }),
    });
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, estimated_delivery: estimate } : o)));
  }

  async function toggleStationReady(id: number, target: "pizza" | "other", ready: boolean) {
    const field = target === "pizza" ? "station_pizza_ready" : "station_other_ready";
    await fetch(`/api/admin/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: ready }),
    });
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, [field]: ready ? 1 : 0 } : o)));
  }

  // Each station picks its own rough prep time — purely so the OTHER
  // station (and the owner) can see a live countdown of how much longer
  // this part will take, never shown to the customer. Picking again just
  // restarts the clock; the server 400s once that station is already
  // marked ready (setStationReady above), matching the picker being hidden
  // in that case below.
  async function setStationPrepTime(id: number, target: "pizza" | "other", estimate: DeliveryEstimate) {
    const field = target === "pizza" ? "station_pizza_prep_estimate" : "station_other_prep_estimate";
    const startedField = target === "pizza" ? "station_pizza_prep_started_at" : "station_other_prep_started_at";
    const res = await fetch(`/api/admin/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: estimate }),
    });
    if (!res.ok) return;
    const now = new Date().toISOString();
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, [field]: estimate, [startedField]: now } : o))
    );
  }

  // A station-restricted employee only ever sees orders that actually have
  // something for them to prep — an all-pizza order has nothing in it for
  // the "Всичко без пици" station, and vice versa, so there's no reason to
  // clutter their list with it.
  const visibleOrders =
    station === "all"
      ? orders
      : orders.filter((order) => {
          const items: OrderItem[] = JSON.parse(order.items_json);
          return station === "pizza"
            ? items.some((i) => i.is_pizza)
            : items.some((i) => !i.is_pizza);
        });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-display font-extrabold text-2xl">Поръчки</h1>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as OrderStatus | "")}
          className="rounded-xl border border-border px-3 py-2 text-sm"
        >
          <option value="">Всички статуси</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      {loading && <p className="text-muted text-sm">Зареждане...</p>}

      <div className="space-y-3">
        {visibleOrders.map((order) => {
          const items: OrderItem[] = JSON.parse(order.items_json);
          const isOpen = expanded === order.id;
          return (
            <div key={order.id} className="bg-surface rounded-2xl border border-border overflow-hidden">
              <button
                onClick={() => setExpanded(isOpen ? null : order.id)}
                className="w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 p-4 text-left"
              >
                <div className="min-w-0">
                  <p className="font-semibold truncate">
                    {order.order_number} · {order.customer_name}
                  </p>
                  <p className="text-xs text-muted truncate">
                    {new Date(order.created_at).toLocaleString("bg-BG")} · {order.phone}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap sm:shrink-0">
                  <span className="font-bold">{formatPrice(order.total)}</span>
                  {order.courier_id && (
                    <span className="text-xs bg-accent-dark/10 text-accent-dark font-semibold px-2 py-1 rounded-full whitespace-nowrap">
                      🛵 {couriers.find((c) => c.id === order.courier_id)?.name ?? "Куриер"}
                    </span>
                  )}
                  {order.estimated_delivery && (
                    <span className="text-xs bg-success/10 text-success font-semibold px-2 py-1 rounded-full whitespace-nowrap">
                      ⏱ {estimateLabel(order.estimated_delivery)}
                    </span>
                  )}
                  {items.some((i) => i.is_pizza) && (
                    <span
                      className={`text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap ${
                        order.station_pizza_ready
                          ? "bg-success/10 text-success"
                          : "bg-black/5 text-muted"
                      }`}
                    >
                      🍕 {order.station_pizza_ready ? "Готово" : "Не е готово"}
                    </span>
                  )}
                  {items.some((i) => !i.is_pizza) && (
                    <span
                      className={`text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap ${
                        order.station_other_ready
                          ? "bg-success/10 text-success"
                          : "bg-black/5 text-muted"
                      }`}
                    >
                      🍽️ {order.station_other_ready ? "Готово" : "Не е готово"}
                    </span>
                  )}
                  <span
                    className={`text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap ${STATUS_PILL_STYLES[order.status]}`}
                  >
                    {STATUS_LABELS[order.status]}
                  </span>
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-border p-4 space-y-4">
                  <ul className="text-sm space-y-1">
                    {items.map((item, idx) => {
                      // A station-restricted view (pizza-only or
                      // everything-but-pizza staff) actively highlights
                      // whichever items ARE theirs — bold text on a light
                      // tinted background — and dims the rest, so it's
                      // unmistakable at a glance even when their own items
                      // are a small minority of the order (just dimming the
                      // others reads as "everything is gray" when there's
                      // only one relevant line among many).
                      const isOwn =
                        station === "all" ||
                        (station === "pizza" && item.is_pizza) ||
                        (station === "other" && !item.is_pizza);
                      const isDimmed = station !== "all" && !isOwn;
                      // Once a station presses its own "Готово" toggle below,
                      // every item belonging to that station turns green
                      // here too — not just the toggle button — visible to
                      // everyone looking at the order, regardless of which
                      // station they're viewing from.
                      const isReady = item.is_pizza ? Boolean(order.station_pizza_ready) : Boolean(order.station_other_ready);
                      return (
                    <li
                      key={idx}
                      className={`flex flex-col gap-0.5 rounded-lg px-2 py-1 -mx-2 ${
                        isReady
                          ? "bg-success/10 font-semibold"
                          : isDimmed
                            ? "opacity-40"
                            : station !== "all"
                              ? "bg-brand/5 font-semibold"
                              : ""
                      }`}
                    >
                        <div className="flex justify-between">
                          <span className={isReady ? "text-success" : isDimmed || station === "all" ? "text-muted" : "text-foreground"}>
                            {isReady && <span className="mr-1">✓</span>}
                            {item.is_pizza && <span className="mr-1">🍕</span>}
                            {item.quantity}× {item.name}
                            {item.sizeLabel ? ` (${item.sizeLabel})` : ""}
                            {item.extras.length > 0 && (
                              <span className="text-xs">
                                {" "}
                                + {item.extras.map((e) => e.name).join(", ")}
                              </span>
                            )}
                            {item.removed && item.removed.length > 0 && (
                              <span className="block text-xs text-brand font-semibold">
                                Без: {item.removed.join(", ")}
                              </span>
                            )}
                          </span>
                          <span className="font-semibold">{formatPrice(item.lineTotal)}</span>
                        </div>
                        {/* Combo product — show what it's actually made of, so
                            whoever's preparing the order doesn't need to go
                            look up the offer's recipe separately. */}
                        {item.components && item.components.length > 0 && (
                          <ul className="ml-3 border-l-2 border-border pl-2 text-xs text-muted space-y-0.5">
                            {item.components.map((c, ci) => (
                              <li key={ci}>
                                {c.quantity * item.quantity}× {c.name}
                                {c.sizeLabel ? ` (${c.sizeLabel})` : ""}
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                      );
                    })}
                  </ul>
                  {/* The label always names the station and says "Готово" —
                      it doesn't flip between "not ready"/"ready" text
                      anymore, only the color does (outline -> solid green),
                      so the button reads as a single toggle switch rather
                      than two different instructions. */}
                  {(items.some((i) => i.is_pizza) || items.some((i) => !i.is_pizza)) && (
                    <div className="flex flex-wrap gap-3">
                      {items.some((i) => i.is_pizza) && (
                        <button
                          disabled={station !== "all" && station !== "pizza"}
                          onClick={() =>
                            toggleStationReady(order.id, "pizza", !order.station_pizza_ready)
                          }
                          className={`text-sm font-bold px-5 py-2.5 rounded-full border-2 disabled:opacity-40 disabled:cursor-not-allowed ${
                            order.station_pizza_ready
                              ? "bg-success text-white border-success"
                              : "border-border text-foreground/70"
                          }`}
                        >
                          🍕 Пицария · Готово
                        </button>
                      )}
                      {items.some((i) => !i.is_pizza) && (
                        <button
                          disabled={station !== "all" && station !== "other"}
                          onClick={() =>
                            toggleStationReady(order.id, "other", !order.station_other_ready)
                          }
                          className={`text-sm font-bold px-5 py-2.5 rounded-full border-2 disabled:opacity-40 disabled:cursor-not-allowed ${
                            order.station_other_ready
                              ? "bg-success text-white border-success"
                              : "border-border text-foreground/70"
                          }`}
                        >
                          🌯 Дюнери · Готово
                        </button>
                      )}
                    </div>
                  )}
                  {/* Internal-only prep-time picker + live countdown, per
                      station — never shown to the customer. Each station
                      picks its own rough duration so the OTHER station (and
                      the owner) has a sense of how much longer that part
                      will take ("за да има разбиране между двете
                      станции"). Picking is only enabled for the owning
                      station (or an 'all' session); the other side just
                      watches the countdown. Once a station marks itself
                      ready, its picker is replaced with a plain "Готово" —
                      nothing left to time. */}
                  {(items.some((i) => i.is_pizza) || items.some((i) => !i.is_pizza)) && (
                    <div className="grid sm:grid-cols-2 gap-3">
                      {items.some((i) => i.is_pizza) && (
                        <div className="rounded-xl border border-border p-3 space-y-1.5">
                          <p className="text-xs font-semibold text-muted">🍕 Пицария · време за приготвяне</p>
                          {order.station_pizza_ready ? (
                            <p className="text-sm font-semibold text-success">Готово</p>
                          ) : (
                            <>
                              {order.station_pizza_prep_estimate && order.station_pizza_prep_started_at && (
                                <p className="text-sm">
                                  Остава:{" "}
                                  <PrepTimer
                                    estimate={order.station_pizza_prep_estimate}
                                    startedAt={order.station_pizza_prep_started_at}
                                  />
                                </p>
                              )}
                              {(station === "all" || station === "pizza") && (
                                <div className="flex flex-wrap gap-1.5">
                                  {DELIVERY_ESTIMATE_OPTIONS.map((opt) => (
                                    <button
                                      key={opt}
                                      onClick={() => setStationPrepTime(order.id, "pizza", opt)}
                                      className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                                        order.station_pizza_prep_estimate === opt
                                          ? "bg-brand text-white border-brand"
                                          : "border-border text-foreground/70"
                                      }`}
                                    >
                                      {estimateLabel(opt)}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}
                      {items.some((i) => !i.is_pizza) && (
                        <div className="rounded-xl border border-border p-3 space-y-1.5">
                          <p className="text-xs font-semibold text-muted">🌯 Дюнери · време за приготвяне</p>
                          {order.station_other_ready ? (
                            <p className="text-sm font-semibold text-success">Готово</p>
                          ) : (
                            <>
                              {order.station_other_prep_estimate && order.station_other_prep_started_at && (
                                <p className="text-sm">
                                  Остава:{" "}
                                  <PrepTimer
                                    estimate={order.station_other_prep_estimate}
                                    startedAt={order.station_other_prep_started_at}
                                  />
                                </p>
                              )}
                              {(station === "all" || station === "other") && (
                                <div className="flex flex-wrap gap-1.5">
                                  {DELIVERY_ESTIMATE_OPTIONS.map((opt) => (
                                    <button
                                      key={opt}
                                      onClick={() => setStationPrepTime(order.id, "other", opt)}
                                      className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                                        order.station_other_prep_estimate === opt
                                          ? "bg-brand text-white border-brand"
                                          : "border-border text-foreground/70"
                                      }`}
                                    >
                                      {estimateLabel(opt)}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="text-sm grid sm:grid-cols-2 gap-1 text-muted">
                    <p>
                      Тип: {order.order_type === "pickup" ? "🏠 Вземане от място" : "🚴 Доставка"}
                    </p>
                    <p>Адрес: {order.address}</p>
                    {order.quarter && <p>Квартал: {order.quarter}</p>}
                    {order.address_notes && <p>Етаж/апартамент: {order.address_notes}</p>}
                    {order.intercom && <p>Звънец: {order.intercom}</p>}
                    <p>Плащане: {paymentLabel(order.payment_method)}</p>
                    <p>
                      Заявено време:{" "}
                      {order.requested_time ? (
                        <span className="font-semibold text-foreground">
                          {formatRequestedTime(order.requested_time)}
                        </span>
                      ) : (
                        "Възможно най-скоро"
                      )}
                    </p>
                    {order.promo_code && <p>Промо код: {order.promo_code}</p>}
                    {order.notes && <p>Бележки: {order.notes}</p>}
                  </div>
                  {/* Delivery-time override and courier assignment concern
                      the WHOLE order (one delivery, one customer) — kept
                      owner/"Всичко"-only. Accepting the order ("Приета" /
                      "Потвърдена") is now open to station-restricted staff
                      too — that's as far as "приемат поръчките" goes for
                      them; everything past that (preparing/delivering/
                      delivered/cancelled) stays owner-only, same as the
                      server-side check. */}
                  {station === "all" ? (
                    <>
                      <div className="flex flex-wrap gap-2">
                        {STATUS_OPTIONS.map((s) => (
                          <button
                            key={s}
                            onClick={() => changeStatus(order.id, s)}
                            className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${
                              order.status === s
                                ? "bg-brand text-white border-brand"
                                : "border-border text-foreground/70"
                            }`}
                          >
                            {STATUS_LABELS[s]}
                          </button>
                        ))}
                      </div>
                      <div>
                        <label className="text-xs text-muted block mb-1">Време за доставка</label>
                        <div className="flex flex-wrap gap-2">
                          {DELIVERY_ESTIMATE_OPTIONS.map((opt) => {
                            const isSelected =
                              (order.estimated_delivery ?? suggestedEstimate) === opt;
                            const isSuggested = !order.estimated_delivery && opt === suggestedEstimate;
                            return (
                              <button
                                key={opt}
                                onClick={() => setEstimate(order.id, opt)}
                                className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${
                                  isSelected
                                    ? "bg-success text-white border-success"
                                    : "border-border text-foreground/70"
                                }`}
                              >
                                {estimateLabel(opt)}
                                {isSuggested ? " (предложено)" : ""}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-muted block mb-1">Куриер</label>
                        <select
                          value={order.courier_id ?? ""}
                          onChange={(e) =>
                            assignCourier(order.id, e.target.value ? Number(e.target.value) : null)
                          }
                          className="w-full rounded-xl border border-border px-3 py-2 text-sm"
                        >
                          <option value="">Без назначен куриер</option>
                          {couriers.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} {c.active ? "" : "(изключен)"}
                            </option>
                          ))}
                        </select>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex flex-wrap gap-2">
                        {STAFF_VISIBLE_STATUSES.map((s) => (
                          <button
                            key={s}
                            onClick={() => changeStatus(order.id, s)}
                            className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${
                              order.status === s
                                ? "bg-brand text-white border-brand"
                                : "border-border text-foreground/70"
                            }`}
                          >
                            {STATUS_LABELS[s]}
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-muted">
                        Следващите стъпки (приготвяне, доставка) и куриерът се управляват от собственика.
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {!loading && visibleOrders.length === 0 && (
          <p className="text-muted text-sm text-center py-10">Няма поръчки в тази категория.</p>
        )}
      </div>
    </div>
  );
}

// Live "how much longer" countdown for one station's self-picked prep time —
// visible to both stations and the owner, never the customer. Ticks its own
// `now` locally (same pattern as the customer-facing countdown ring) so no
// parent re-render is needed just to keep the numbers moving.
function PrepTimer({ estimate, startedAt }: { estimate: string; startedAt: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);
  const deadline = new Date(startedAt).getTime() + estimateUpperMinutes(estimate) * 60000;
  const remainingMs = deadline - now;
  const overdue = remainingMs <= 0;
  const totalSeconds = Math.abs(Math.round(remainingMs / 1000));
  const mm = Math.floor(totalSeconds / 60);
  const ss = totalSeconds % 60;
  return (
    <span className={`font-mono tabular-nums ${overdue ? "text-brand" : "text-foreground"}`}>
      {overdue ? "+" : ""}
      {mm}:{ss.toString().padStart(2, "0")}
    </span>
  );
}

function paymentLabel(method: string) {
  if (method === "cash") return "Наложен платеж (в брой)";
  if (method === "card_on_delivery") return "Наложен платеж (карта на куриера)";
  if (method === "stripe") return "Картово плащане онлайн";
  return method;
}
