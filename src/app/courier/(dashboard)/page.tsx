"use client";

import { useEffect, useRef, useState } from "react";
import { formatPrice } from "@/lib/format";
import { playNewOrderChime } from "@/lib/notify-sound";
import type { Order, DeliveryZone } from "@/lib/types";

type OrderWithZone = Order & { zone?: DeliveryZone };

const PAYMENT_LABELS: Record<string, string> = {
  cash: "Кеш при доставка",
  card_on_delivery: "Карта на куриера",
  stripe: "Платено онлайн ✔",
};

export default function CourierDashboardPage() {
  const [tab, setTab] = useState<"available" | "mine">("available");
  const [available, setAvailable] = useState<OrderWithZone[]>([]);
  const [mine, setMine] = useState<OrderWithZone[]>([]);
  const [delivered, setDelivered] = useState<OrderWithZone[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState("");
  // Only "available" orders get a chime — a new entry there means a fresh
  // delivery order just came in for any courier to grab. Null until the
  // first load resolves, so opening the app never sounds off for orders
  // that were already sitting in the pool.
  const seenAvailableIdsRef = useRef<Set<number> | null>(null);

  async function load() {
    const [availRes, mineRes] = await Promise.all([
      fetch("/api/courier/orders/available"),
      fetch("/api/courier/orders/mine"),
    ]);
    const availData = await availRes.json();
    const mineData = await mineRes.json();
    const fetchedAvailable: OrderWithZone[] = availData.orders ?? [];
    const seen = seenAvailableIdsRef.current;
    if (seen === null) {
      seenAvailableIdsRef.current = new Set(fetchedAvailable.map((o) => o.id));
    } else {
      const hasNewOrder = fetchedAvailable.some((o) => !seen.has(o.id));
      if (hasNewOrder) playNewOrderChime();
      for (const o of fetchedAvailable) seen.add(o.id);
    }
    setAvailable(fetchedAvailable);
    setMine(mineData.active ?? []);
    setDelivered(mineData.delivered ?? []);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: initial fetch + polling refresh
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, []);

  async function claim(id: number) {
    setError("");
    setBusyId(id);
    const res = await fetch(`/api/courier/orders/${id}/claim`, { method: "POST" });
    const data = await res.json();
    setBusyId(null);
    if (!res.ok) {
      setError(data.error ?? "Грешка");
      load();
      return;
    }
    setTab("mine");
    load();
  }

  async function release(id: number) {
    setBusyId(id);
    await fetch(`/api/courier/orders/${id}/release`, { method: "POST" });
    setBusyId(null);
    load();
  }

  async function setStatus(id: number, status: "delivering" | "delivered") {
    setBusyId(id);
    await fetch(`/api/courier/orders/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setBusyId(null);
    load();
  }

  return (
    <div className="space-y-5">
      <div className="flex gap-2">
        <TabButton active={tab === "available"} onClick={() => setTab("available")}>
          Свободни ({available.length})
        </TabButton>
        <TabButton active={tab === "mine"} onClick={() => setTab("mine")}>
          Моите ({mine.length})
        </TabButton>
      </div>

      {error && <p className="text-sm text-brand font-semibold">{error}</p>}

      {tab === "available" && (
        <div className="space-y-3">
          {available.map((o) => (
            <div key={o.id} className="bg-surface rounded-2xl border border-border p-4 space-y-2">
              <div className="flex justify-between items-start gap-2">
                <div>
                  <p className="font-semibold">{o.order_number}</p>
                  <p className="text-sm text-muted">{o.address}</p>
                  {o.quarter && <p className="text-xs text-muted">{o.quarter}</p>}
                </div>
                <span className="font-bold text-brand">{formatPrice(o.total)}</span>
              </div>
              <p className="text-xs text-muted">{PAYMENT_LABELS[o.payment_method]}</p>
              <button
                onClick={() => claim(o.id)}
                disabled={busyId === o.id}
                className="w-full bg-brand text-white rounded-xl py-2.5 font-bold text-sm disabled:opacity-60"
              >
                {busyId === o.id ? "..." : "Вземи поръчката"}
              </button>
            </div>
          ))}
          {available.length === 0 && (
            <p className="text-muted text-sm text-center py-10">
              Няма свободни поръчки в момента.
            </p>
          )}
        </div>
      )}

      {tab === "mine" && (
        <div className="space-y-6">
          <div className="space-y-3">
            {mine.map((o) => (
              <div key={o.id} className="bg-surface rounded-2xl border border-border p-4 space-y-2">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <p className="font-semibold">{o.order_number}</p>
                    <p className="text-sm text-muted">{o.address}</p>
                    {o.quarter && <p className="text-xs text-muted">{o.quarter}</p>}
                    {o.address_notes && (
                      <p className="text-xs text-muted">Етаж/апартамент: {o.address_notes}</p>
                    )}
                    {o.intercom && <p className="text-xs text-muted">Звънец: {o.intercom}</p>}
                    <p className="text-xs text-muted">📞 {o.phone}</p>
                  </div>
                  <span className="font-bold text-brand">{formatPrice(o.total)}</span>
                </div>
                <p className="text-xs text-muted">{PAYMENT_LABELS[o.payment_method]}</p>
                {o.notes && <p className="text-xs text-muted">Бележка: {o.notes}</p>}
                <div className="flex gap-2 pt-1">
                  {o.status !== "delivering" ? (
                    <button
                      onClick={() => setStatus(o.id, "delivering")}
                      disabled={busyId === o.id}
                      className="flex-1 bg-accent-dark text-white rounded-xl py-2.5 font-bold text-sm disabled:opacity-60"
                    >
                      Тръгвам за доставка
                    </button>
                  ) : (
                    <button
                      onClick={() => setStatus(o.id, "delivered")}
                      disabled={busyId === o.id}
                      className="flex-1 bg-success text-white rounded-xl py-2.5 font-bold text-sm disabled:opacity-60"
                    >
                      Доставена ✔
                    </button>
                  )}
                  <button
                    onClick={() => release(o.id)}
                    disabled={busyId === o.id}
                    className="px-4 rounded-xl border border-border font-semibold text-sm"
                  >
                    Откажи
                  </button>
                </div>
              </div>
            ))}
            {mine.length === 0 && (
              <p className="text-muted text-sm text-center py-6">
                Нямате взети поръчки в момента.
              </p>
            )}
          </div>

          {delivered.length > 0 && (
            <div>
              <h2 className="font-semibold text-sm text-muted mb-2">Последно доставени</h2>
              <div className="space-y-2">
                {delivered.map((o) => (
                  <div
                    key={o.id}
                    className="flex justify-between text-sm bg-black/5 rounded-xl px-3 py-2"
                  >
                    <span>{o.order_number}</span>
                    <span className="font-semibold">{formatPrice(o.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-xl py-2.5 text-sm font-semibold border transition-colors ${
        active ? "bg-brand text-white border-brand" : "border-border text-foreground/70"
      }`}
    >
      {children}
    </button>
  );
}
