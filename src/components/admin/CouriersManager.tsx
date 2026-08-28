"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { CourierPublic } from "@/lib/types";

const MapView = dynamic(() => import("@/components/shared/MapView").then((m) => m.MapView), {
  ssr: false,
});

const emptyForm = {
  id: null as number | null,
  name: "",
  phone: "",
  password: "",
};

export function CouriersManager({ initialCouriers }: { initialCouriers: CourierPublic[] }) {
  const [couriers, setCouriers] = useState(initialCouriers);
  const [liveLocations, setLiveLocations] = useState<CourierPublic[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    async function loadLocations() {
      const res = await fetch("/api/admin/couriers/locations");
      const data = await res.json();
      setLiveLocations(data.couriers ?? []);
    }
    loadLocations();
    const interval = setInterval(loadLocations, 15000);
    return () => clearInterval(interval);
  }, []);

  function openNew() {
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEdit(c: CourierPublic) {
    setForm({ id: c.id, name: c.name, phone: c.phone, password: "" });
    setShowForm(true);
  }

  async function save() {
    if (!form.name || !form.phone || (!form.id && !form.password)) {
      alert("Име, телефон и парола (за нов куриер) са задължителни.");
      return;
    }
    if (form.id) {
      const payload: Record<string, unknown> = { name: form.name, phone: form.phone };
      if (form.password) payload.password = form.password;
      await fetch(`/api/admin/couriers/${form.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      const res = await fetch("/api/admin/couriers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error ?? "Грешка");
        return;
      }
    }
    setShowForm(false);
    const res = await fetch("/api/admin/couriers");
    const data = await res.json();
    setCouriers(data.couriers ?? []);
  }

  async function toggleActive(c: CourierPublic) {
    await fetch(`/api/admin/couriers/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !c.active }),
    });
    setCouriers((prev) =>
      prev.map((x) => (x.id === c.id ? { ...x, active: c.active ? 0 : 1 } : x))
    );
  }

  async function remove(id: number) {
    if (!confirm("Изтриване на куриера?")) return;
    await fetch(`/api/admin/couriers/${id}`, { method: "DELETE" });
    setCouriers((prev) => prev.filter((c) => c.id !== id));
  }

  const markers = liveLocations
    .filter((c) => c.last_lat != null && c.last_lng != null)
    .map((c) => ({
      id: c.id,
      lat: c.last_lat as number,
      lng: c.last_lng as number,
      label: c.name,
    }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-display font-extrabold text-2xl">Куриери</h1>
        <button onClick={openNew} className="bg-brand text-white rounded-xl px-4 py-2.5 font-semibold text-sm">
          + Нов куриер
        </button>
      </div>

      <div>
        <h2 className="font-semibold text-sm text-muted mb-2">
          Живо местоположение ({markers.length} онлайн)
        </h2>
        <MapView markers={markers} />
      </div>

      <div className="grid gap-3">
        {couriers.map((c) => (
          <div
            key={c.id}
            className="bg-surface rounded-2xl border border-border p-4 flex items-center justify-between gap-3 flex-wrap"
          >
            <div>
              <p className="font-semibold">{c.name}</p>
              <p className="text-xs text-muted">
                📞 {c.phone}
                {c.last_location_at
                  ? ` · последна позиция: ${new Date(c.last_location_at).toLocaleTimeString("bg-BG")}`
                  : " · няма данни за позиция"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => toggleActive(c)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full ${
                  c.active ? "bg-success/10 text-success" : "bg-black/5 text-muted"
                }`}
              >
                {c.active ? "Активен" : "Изключен"}
              </button>
              <button
                onClick={() => openEdit(c)}
                className="text-xs font-semibold px-3 py-1.5 rounded-full border border-border"
              >
                Редакция
              </button>
              <button
                onClick={() => remove(c.id)}
                className="text-xs font-semibold px-3 py-1.5 rounded-full border border-border text-brand"
              >
                Изтрий
              </button>
            </div>
          </div>
        ))}
        {couriers.length === 0 && (
          <p className="text-muted text-sm text-center py-10">Все още няма добавени куриери.</p>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <button className="absolute inset-0 bg-black/50" onClick={() => setShowForm(false)} />
          <div className="relative bg-surface w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-bold text-lg">
                {form.id ? "Редакция на куриер" : "Нов куриер"}
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="h-8 w-8 rounded-full bg-black/5 grid place-items-center"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3">
              <input
                className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm"
                placeholder="Име на куриера"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
              <input
                className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm"
                placeholder="Телефон (за вход)"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
              <input
                type="password"
                className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm"
                placeholder={form.id ? "Нова парола (по желание)" : "Парола"}
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              />
              <p className="text-xs text-muted">
                Куриерът влиза на /courier/login с този телефон и парола.
              </p>
              <button onClick={save} className="w-full bg-brand text-white rounded-xl py-3 font-bold mt-2">
                Запази куриера
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
