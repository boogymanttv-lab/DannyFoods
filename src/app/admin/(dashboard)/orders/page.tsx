"use client";

import { useEffect, useRef, useState } from "react";
import { formatPrice } from "@/lib/format";
import { formatRequestedTime } from "@/lib/delivery-slots";
import { playNewOrderChime } from "@/lib/notify-sound";
import {
  DELIVERY_ESTIMATE_OPTIONS,
  combineEstimates,
  estimateLabel,
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

export default function AdminOrdersPage() {
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
        {orders.map((order) => {
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
                  <span className="text-xs bg-brand/10 text-brand font-semibold px-2 py-1 rounded-full whitespace-nowrap">
                    {STATUS_LABELS[order.status]}
                  </span>
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-border p-4 space-y-4">
                  <ul className="text-sm space-y-1">
                    {items.map((item, idx) => (
                      <li key={idx} className="flex flex-col gap-0.5">
                        <div className="flex justify-between">
                          <span className="text-muted">
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
                    ))}
                  </ul>
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
                </div>
              )}
            </div>
          );
        })}
        {!loading && orders.length === 0 && (
          <p className="text-muted text-sm text-center py-10">Няма поръчки в тази категория.</p>
        )}
      </div>
    </div>
  );
}

function paymentLabel(method: string) {
  if (method === "cash") return "Наложен платеж (в брой)";
  if (method === "card_on_delivery") return "Наложен платеж (карта на куриера)";
  if (method === "stripe") return "Картово плащане онлайн";
  return method;
}
