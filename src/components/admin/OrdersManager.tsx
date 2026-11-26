"use client";

import { useEffect, useRef, useState } from "react";
import { formatPrice } from "@/lib/format";
import { formatRequestedTime } from "@/lib/delivery-slots";
import { SOS_PATTERN_MS, isAudioReady, playSosAlarm, unlockAudio } from "@/lib/notify-sound";
import { shopClock } from "@/lib/delivery-slots";
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

// The whole order card/row gets a soft tint of the same color as its
// status pill — not just the little pill itself — so a whole row reads as
// "this one needs attention" at a glance without having to zero in on one
// small badge. Kept subtle (light tint + matching border) so item text and
// prices inside stay perfectly readable.
// Solid pastel backgrounds, not transparent tints — the admin panel has a
// busy decorative pattern behind everything, and a semi-transparent tint
// (bg-brand/5 etc.) let it bleed straight through the card, making the text
// on top hard to read. Solid, opaque colors sit cleanly on top of it.
const STATUS_ROW_STYLES: Record<OrderStatus, string> = {
  new: "bg-rose-50 border-rose-200",
  confirmed: "bg-emerald-50 border-emerald-200",
  preparing: "bg-yellow-50 border-yellow-200",
  delivering: "bg-blue-50 border-blue-200",
  delivered: "bg-orange-50 border-orange-200",
  cancelled: "bg-gray-100 border-border",
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
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<OrderStatus | "">("");
  const [bulkCourier, setBulkCourier] = useState<string>("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkMessage, setBulkMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [timeSuggestion, setTimeSuggestion] = useState<DeliveryEstimate>("15-20");
  const [loadSuggestion, setLoadSuggestion] = useState<DeliveryEstimate>("15-20");
  const suggestedEstimate = combineEstimates(timeSuggestion, loadSuggestion);
  // Which working day is shown. "" = always today (Bulgarian time), so at
  // midnight the list switches to the new day on its own. Only the owner
  // view can pick an older day; stations always see today.
  const [day, setDay] = useState<string>("");
  const [today, setToday] = useState<string>(() => shopClock(new Date()).dateKey);
  // Today's orders are always fetched (even while the owner looks at an
  // older day) so the alarm never misses a new order.
  const [todayOrders, setTodayOrders] = useState<Order[]>([]);
  const [connectionError, setConnectionError] = useState("");
  const [actionError, setActionError] = useState("");
  const [audioReady, setAudioReady] = useState(false);
  // Orders someone already opened on this device — the alarm stops for them.
  const [acked, setAcked] = useState<Set<number>>(() => readAcked());
  // Bumped on every button press. A poll that started before the press is
  // thrown away when it returns, so it can't overwrite what was just
  // clicked with stale data (that used to make buttons look like they
  // "didn't work" and orders briefly vanish or jump back).
  const mutationVersionRef = useRef(0);
  const loadingRef = useRef(false);
  const dayRef = useRef(day);
  useEffect(() => {
    dayRef.current = day;
  }, [day]);
  const viewingDay = day || today;

  async function fetchDay(d: string | null): Promise<{ orders: Order[]; today: string } | null> {
    const url = d ? `/api/admin/orders?day=${d}` : "/api/admin/orders";
    const res = await fetch(url, { cache: "no-store" });
    if (res.status === 401 || res.status === 403) {
      throw new Error("auth");
    }
    if (!res.ok) throw new Error("http");
    const data = await res.json();
    if (!Array.isArray(data.orders)) throw new Error("bad");
    return { orders: data.orders as Order[], today: String(data.today ?? "") };
  }

  async function load() {
    if (loadingRef.current) return;
    loadingRef.current = true;
    const versionAtStart = mutationVersionRef.current;
    const requestedDay = dayRef.current;
    try {
      const todayData = await fetchDay(null);
      const dayData =
        requestedDay && requestedDay !== todayData?.today ? await fetchDay(requestedDay) : todayData;
      // Something was clicked (or another day picked) while this request was
      // in flight — its data is stale, so skip it and fetch again.
      if (dayRef.current !== requestedDay) {
        setTimeout(load, 0);
        return;
      }
      if (mutationVersionRef.current !== versionAtStart) return;
      if (todayData?.today) setToday(todayData.today);
      setTodayOrders(todayData?.orders ?? []);
      setOrders(dayData?.orders ?? []);
      setConnectionError("");
    } catch (e) {
      // Keep the last good list on screen instead of wiping it — a failed
      // request used to replace everything with an empty list.
      setConnectionError(
        e instanceof Error && e.message === "auth"
          ? "Сесията изтече. Презареди страницата и влез отново, иначе няма да виждаш нови поръчки!"
          : "Няма връзка със сървъра. Опитваме отново..."
      );
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: initial fetch + polling refresh
    load();
    const interval = setInterval(load, 10000);
    // Tablets/phones pause timers in the background or when the screen
    // dims; refresh immediately when the page becomes visible again.
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    window.addEventListener("online", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener("online", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day]);

  // Keep the screen of the kitchen tablet/phone from going to sleep while
  // the orders page is open (where the browser supports it).
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    async function requestLock() {
      try {
        const wl = (navigator as unknown as { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } }).wakeLock;
        if (wl && document.visibilityState === "visible") lock = await wl.request("screen");
      } catch {
        // not supported / denied — nothing to do
      }
    }
    requestLock();
    const onVisible = () => {
      if (document.visibilityState === "visible") requestLock();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      lock?.release().catch(() => {});
    };
  }, []);

  // Browsers block sound until the page is clicked once. Any click anywhere
  // on the page unlocks it; until then a big red button asks for it.
  useEffect(() => {
    const check = () => setAudioReady(isAudioReady());
    const onClick = () => {
      unlockAudio().then(check);
    };
    unlockAudio().then(check);
    document.addEventListener("pointerdown", onClick);
    document.addEventListener("keydown", onClick);
    const interval = setInterval(check, 3000);
    return () => {
      document.removeEventListener("pointerdown", onClick);
      document.removeEventListener("keydown", onClick);
      clearInterval(interval);
    };
  }, []);

  function isForThisStation(order: Order) {
    if (station === "all") return true;
    const items: OrderItem[] = JSON.parse(order.items_json);
    return station === "pizza" ? items.some((i) => i.is_pizza) : items.some((i) => !i.is_pizza);
  }

  // Orders that keep the SOS alarm going: brand new, not yet opened on this
  // device, belonging to this station. Card payments that haven't been paid
  // yet don't count — the customer may still be on the Stripe page.
  const alarmOrders = todayOrders.filter(
    (o) =>
      o.status === "new" &&
      !acked.has(o.id) &&
      !(o.payment_method === "stripe" && o.payment_status !== "paid") &&
      isForThisStation(o)
  );
  const alarmOn = alarmOrders.length > 0;

  useEffect(() => {
    if (!alarmOn) return;
    playSosAlarm();
    const interval = setInterval(playSosAlarm, SOS_PATTERN_MS);
    const originalTitle = document.title;
    let flip = false;
    const titleInterval = setInterval(() => {
      flip = !flip;
      document.title = flip ? "🚨 НОВА ПОРЪЧКА!" : originalTitle;
    }, 800);
    return () => {
      clearInterval(interval);
      clearInterval(titleInterval);
      document.title = originalTitle;
    };
  }, [alarmOn]);

  function acknowledge(id: number) {
    setAcked((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      writeAcked(next);
      return next;
    });
  }

  function openOrder(id: number) {
    acknowledge(id);
    setExpanded(id);
    // If the order is on another filter tab, reset the filter so it shows.
    setFilter("");
    if (day && day !== today) setDay("");
    setTimeout(() => {
      document.getElementById(`order-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  }

  async function patchOrder(id: number, body: Record<string, unknown>): Promise<boolean> {
    mutationVersionRef.current++;
    setActionError("");
    try {
      const res = await fetch(`/api/admin/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setActionError(
          res.status === 401
            ? "Сесията изтече — презареди страницата и влез отново."
            : (data.error ?? "Промяната не беше записана. Опитай пак.")
        );
        load();
        return false;
      }
      return true;
    } catch {
      setActionError("Няма връзка — промяната не беше записана. Опитай пак.");
      return false;
    } finally {
      mutationVersionRef.current++;
    }
  }

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

  function updateLocal(id: number, fn: (o: Order) => Order) {
    setOrders((prev) => prev.map((o) => (o.id === id ? fn(o) : o)));
    setTodayOrders((prev) => prev.map((o) => (o.id === id ? fn(o) : o)));
  }

  async function changeStatus(id: number, status: OrderStatus) {
    acknowledge(id);
    if (!(await patchOrder(id, { status }))) return;
    updateLocal(id, (o) => ({ ...o, status }));
  }

  async function assignCourier(id: number, courierId: number | null) {
    if (!(await patchOrder(id, { courier_id: courierId }))) return;
    updateLocal(id, (o) => ({ ...o, courier_id: courierId }));
  }

  async function setEstimate(id: number, estimate: string) {
    if (!(await patchOrder(id, { estimated_delivery: estimate }))) return;
    updateLocal(id, (o) => ({ ...o, estimated_delivery: estimate }));
  }

  async function toggleStationReady(id: number, target: "pizza" | "other", ready: boolean) {
    const field = target === "pizza" ? "station_pizza_ready" : "station_other_ready";
    acknowledge(id);
    if (!(await patchOrder(id, { [field]: ready }))) return;
    updateLocal(id, (o) => ({ ...o, [field]: ready ? 1 : 0 }));
  }

  // Each station picks its own rough prep time — the internal countdown is
  // purely between the two stations (and the owner), but the SLOWER of the
  // two also drives the customer-facing delivery estimate from here on (the
  // server recomputes and restarts that ring on every pick — see the PATCH
  // route). Picking again just restarts this station's own clock; the
  // server 400s once that station is already marked ready (setStationReady
  // above), matching the picker being hidden in that case below.
  async function setStationPrepTime(id: number, target: "pizza" | "other", estimate: DeliveryEstimate) {
    const field = target === "pizza" ? "station_pizza_prep_estimate" : "station_other_prep_estimate";
    const startedField = target === "pizza" ? "station_pizza_prep_started_at" : "station_other_prep_started_at";
    acknowledge(id);
    if (!(await patchOrder(id, { [field]: estimate }))) return;
    const now = new Date().toISOString();
    updateLocal(id, (o) => {
        const pizzaEstimate = target === "pizza" ? estimate : o.station_pizza_prep_estimate;
        const otherEstimate = target === "other" ? estimate : o.station_other_prep_estimate;
        const relevant = [pizzaEstimate, otherEstimate].filter(
          (e): e is DeliveryEstimate => e != null
        );
        const syncedEstimate =
          relevant.length > 0 ? combineEstimates(...relevant) : o.estimated_delivery;
        return {
          ...o,
          [field]: estimate,
          [startedField]: now,
          estimated_delivery: syncedEstimate,
          estimated_delivery_set_at: now,
        };
      });
  }

  // A station-restricted employee only ever sees orders that actually have
  // something for them to prep — an all-pizza order has nothing in it for
  // the "Всичко без пици" station, and vice versa, so there's no reason to
  // clutter their list with it.
  // The status filter is applied here (not on the server) so the alarm and
  // the "new order" detection always see every order of the day.
  const visibleOrders = orders.filter(
    (order) => isForThisStation(order) && (!filter || order.status === filter)
  );

  const canBulk = station === "all";
  const selectedIds = visibleOrders.filter((o) => selected.has(o.id)).map((o) => o.id);
  const allSelected = visibleOrders.length > 0 && selectedIds.length === visibleOrders.length;

  function toggleOne(id: number) {
    setConfirmDelete(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setConfirmDelete(false);
    setSelected(allSelected ? new Set() : new Set(visibleOrders.map((o) => o.id)));
  }

  function clearSelection() {
    setConfirmDelete(false);
    setSelected(new Set());
  }

  async function applyBulk() {
    if (selectedIds.length === 0) return;
    const payload: { ids: number[]; status?: OrderStatus; courier_id?: number | null } = {
      ids: selectedIds,
    };
    if (bulkStatus) payload.status = bulkStatus;
    if (bulkCourier !== "") payload.courier_id = bulkCourier === "none" ? null : Number(bulkCourier);
    if (payload.status === undefined && payload.courier_id === undefined) {
      setBulkMessage("Избери статус или куриер, който да се приложи.");
      return;
    }
    setBulkBusy(true);
    setBulkMessage("");
    mutationVersionRef.current++;
    const res = await fetch("/api/admin/orders/bulk", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    setBulkBusy(false);
    if (!res.ok) {
      setBulkMessage(data.error ?? "Възникна грешка.");
      return;
    }
    setBulkMessage(`Обновени поръчки: ${data.updated}`);
    setBulkStatus("");
    setBulkCourier("");
    await load();
  }

  async function deleteSelected() {
    if (selectedIds.length === 0) return;
    setBulkBusy(true);
    setBulkMessage("");
    mutationVersionRef.current++;
    const res = await fetch("/api/admin/orders/bulk", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: selectedIds }),
    });
    const data = await res.json().catch(() => ({}));
    setBulkBusy(false);
    setConfirmDelete(false);
    if (!res.ok) {
      setBulkMessage(data.error ?? "Възникна грешка.");
      return;
    }
    setSelected(new Set());
    setExpanded(null);
    setBulkMessage(`Изтрити поръчки: ${data.deleted}`);
    await load();
  }

  return (
    <div className="space-y-6">
      {alarmOn && (
        <div className="sticky top-0 z-30 rounded-2xl border-4 border-red-700 bg-red-600 p-4 text-white shadow-xl animate-pulse">
          <p className="font-display text-xl sm:text-2xl font-extrabold">
            🚨 НОВА ПОРЪЧКА{alarmOrders.length > 1 ? ` (${alarmOrders.length})` : ""}! Натисни я, за да спре звукът.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {alarmOrders.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => openOrder(o.id)}
                className="rounded-xl bg-white px-4 py-3 text-base font-extrabold text-red-700 shadow"
              >
                {o.order_number} · {o.customer_name} · {formatPrice(o.total)}
              </button>
            ))}
          </div>
        </div>
      )}

      {!audioReady && (
        <button
          type="button"
          onClick={() => unlockAudio().then(() => setAudioReady(isAudioReady()))}
          className="w-full rounded-2xl border-2 border-red-500 bg-red-50 p-4 text-left font-bold text-red-700"
        >
          🔇 Звукът за нови поръчки е изключен от браузъра. Натисни тук, за да го включиш.
        </button>
      )}

      {connectionError && (
        <p className="rounded-2xl border-2 border-amber-400 bg-amber-50 p-3 text-sm font-bold text-amber-800">
          ⚠️ {connectionError}
        </p>
      )}
      {actionError && (
        <p className="rounded-2xl border-2 border-red-300 bg-red-50 p-3 text-sm font-bold text-red-700">
          ⚠️ {actionError}
        </p>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-display font-extrabold text-2xl">
          Поръчки{" "}
          <span className="text-base font-semibold text-muted">
            · {viewingDay === today ? "днес" : formatDay(viewingDay)}
          </span>
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          {station === "all" && (
            <>
              <input
                type="date"
                value={viewingDay}
                max={today}
                onChange={(e) => {
                  const v = e.target.value;
                  setSelected(new Set());
                  setLoading(true);
                  setDay(!v || v === today ? "" : v);
                }}
                className="rounded-xl border border-border px-3 py-2 text-sm"
                aria-label="Ден"
              />
              {viewingDay !== today && (
                <button
                  type="button"
                  onClick={() => {
                    setSelected(new Set());
                    setDay("");
                  }}
                  className="rounded-xl bg-brand px-3 py-2 text-sm font-bold text-white"
                >
                  Към днес
                </button>
              )}
            </>
          )}
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
      </div>

      {canBulk && visibleOrders.length > 0 && (
        <div className="sticky top-0 z-20 rounded-2xl border border-border bg-white p-3 shadow-sm space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={allSelected}
                onChange={toggleAll}
              />
              Избери всички ({visibleOrders.length})
            </label>
            {selectedIds.length > 0 && (
              <>
                <span className="text-sm font-bold text-brand">Избрани: {selectedIds.length}</span>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="text-sm font-semibold text-muted underline"
                >
                  Откажи избора
                </button>
              </>
            )}
            {bulkMessage && <span className="text-sm font-semibold text-success">{bulkMessage}</span>}
          </div>

          {selectedIds.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={bulkStatus}
                onChange={(e) => setBulkStatus(e.target.value as OrderStatus | "")}
                className="rounded-xl border border-border px-3 py-2 text-sm"
              >
                <option value="">Смени статус...</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
              <select
                value={bulkCourier}
                onChange={(e) => setBulkCourier(e.target.value)}
                className="rounded-xl border border-border px-3 py-2 text-sm"
              >
                <option value="">Назначи куриер...</option>
                <option value="none">Без куриер</option>
                {couriers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={bulkBusy}
                onClick={applyBulk}
                className="rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                Приложи
              </button>
              <span className="flex-1" />
              {!confirmDelete ? (
                <button
                  type="button"
                  disabled={bulkBusy}
                  onClick={() => setConfirmDelete(true)}
                  className="rounded-xl border border-red-300 bg-red-50 px-4 py-2 text-sm font-bold text-red-700 disabled:opacity-50"
                >
                  Изтрий избраните
                </button>
              ) : (
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-red-300 bg-red-50 px-3 py-2">
                  <span className="text-sm font-semibold text-red-800">
                    Ще се изтрият завинаги {selectedIds.length} поръчки. Платените с карта няма да
                    бъдат върнати автоматично. Сигурен ли си?
                  </span>
                  <button
                    type="button"
                    disabled={bulkBusy}
                    onClick={deleteSelected}
                    className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-bold text-white disabled:opacity-50"
                  >
                    Да, изтрий
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="rounded-lg border border-border bg-white px-3 py-1.5 text-sm font-semibold"
                  >
                    Отказ
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {loading && <p className="text-muted text-sm">Зареждане...</p>}

      <div className="space-y-3">
        {visibleOrders.map((order) => {
          const items: OrderItem[] = JSON.parse(order.items_json);
          const isOpen = expanded === order.id;
          const isAlarming = alarmOrders.some((o) => o.id === order.id);
          return (
            <div
              key={order.id}
              id={`order-${order.id}`}
              className={`rounded-2xl border overflow-hidden ${STATUS_ROW_STYLES[order.status]} ${
                isAlarming ? "ring-4 ring-red-500 animate-pulse" : ""
              }`}
            >
              <div className="flex items-stretch">
              {canBulk && (
                <label className="flex items-center pl-4 pr-1 cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-5 w-5"
                    checked={selected.has(order.id)}
                    onChange={() => toggleOne(order.id)}
                    aria-label={order.order_number}
                  />
                </label>
              )}
              <button
                onClick={() => {
                  acknowledge(order.id);
                  setExpanded(isOpen ? null : order.id);
                }}
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
                    className={`text-xs font-bold px-2 py-1 rounded-full whitespace-nowrap ${paymentPill(order).style}`}
                  >
                    {paymentPill(order).label}
                  </span>
                  <span
                    className={`text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap ${STATUS_PILL_STYLES[order.status]}`}
                  >
                    {STATUS_LABELS[order.status]}
                  </span>
                </div>
              </button>
              </div>

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
                  {/* Prep-time picker + live countdown, per station — the
                      countdown display itself is internal, between the two
                      stations (and the owner) only, never shown to the
                      customer as a live clock. Each station picks its own
                      rough duration so the OTHER station has a sense of how
                      much longer that part will take ("за да има разбиране
                      между двете станции"); the slower of the two picks
                      also becomes the customer's own delivery estimate
                      (server-side, restarting their ring — see the PATCH
                      route). Picking is only enabled for the owning station
                      (or an 'all' session); the other side just watches the
                      countdown. Once a station marks itself ready, its
                      picker is replaced with a plain "Готово" — nothing
                      left to time. */}
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
                    <p>
                      Плащане: {paymentLabel(order.payment_method)}
                      {order.payment_method === "stripe" && (
                        <span className="font-semibold"> — {paymentStatusLabel(order.payment_status)}</span>
                      )}
                    </p>
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
          <p className="text-muted text-sm text-center py-10">
            {viewingDay === today ? "Още няма поръчки за днес." : "Няма поръчки за този ден."}
          </p>
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
  // `startedAt` normally comes from Postgres as "YYYY-MM-DD HH:MM:SS" UTC
  // with no timezone marker — passed straight to `new Date(...)`, browsers
  // parse that as *local* time, silently shifting the deadline by the
  // visitor's UTC offset (in Bulgaria's case, hours into the past — hence
  // the huge bogus "+151:00" overdue readouts). Reinterpret it explicitly
  // as UTC by switching to ISO form first, same fix as the customer-facing
  // ring in OrderTracking.tsx. The optimistic client-side update below sets
  // this from `.toISOString()` instead (already real ISO, already has "T"
  // and a trailing "Z") — detect that case so it isn't mangled into an
  // invalid "...Z Z" double suffix.
  const iso = startedAt.includes("T") ? startedAt : startedAt.replace(" ", "T") + "Z";
  const deadline = new Date(iso).getTime() + estimateUpperMinutes(estimate) * 60000;
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

const ACK_KEY = "dd_acked_orders";

function readAcked(): Set<number> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(ACK_KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return new Set(Array.isArray(arr) ? arr.filter((n): n is number => typeof n === "number") : []);
  } catch {
    return new Set();
  }
}

function writeAcked(ids: Set<number>) {
  try {
    // Only the most recent ones matter; keep the stored list small.
    const arr = Array.from(ids).slice(-500);
    window.localStorage.setItem(ACK_KEY, JSON.stringify(arr));
  } catch {
    // storage unavailable — the alarm still stops for this session
  }
}

function formatDay(key: string) {
  const [y, m, d] = key.split("-");
  return `${d}.${m}.${y}`;
}

function paymentStatusLabel(status: string) {
  if (status === "paid") return "платена";
  if (status === "failed") return "плащането е неуспешно";
  return "чака плащане";
}

function paymentPill(order: Order): { label: string; style: string } {
  if (order.payment_method === "stripe") {
    if (order.payment_status === "paid") {
      return { label: "💳 Платена с карта", style: "bg-emerald-600 text-white" };
    }
    if (order.payment_status === "failed") {
      return { label: "⚠️ Неуспешно плащане", style: "bg-red-100 text-red-700" };
    }
    return { label: "⏳ Чака плащане", style: "bg-amber-100 text-amber-800" };
  }
  if (order.payment_method === "card_on_delivery") {
    return { label: "💳 Карта на куриера", style: "bg-black/5 text-foreground/70" };
  }
  return { label: "💵 В брой", style: "bg-black/5 text-foreground/70" };
}

function paymentLabel(method: string) {
  if (method === "cash") return "Наложен платеж (в брой)";
  if (method === "card_on_delivery") return "Наложен платеж (карта на куриера)";
  if (method === "stripe") return "Картово плащане онлайн";
  return method;
}
