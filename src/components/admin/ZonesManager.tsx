"use client";

import { useState } from "react";
import { formatPrice } from "@/lib/format";
import type { DeliveryZone } from "@/lib/types";

const emptyForm = {
  id: null as number | null,
  name: "",
  delivery_fee: "" as string | number,
  min_order: "" as string | number,
};

export function ZonesManager({ initialZones }: { initialZones: DeliveryZone[] }) {
  const [zones, setZones] = useState(initialZones);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);

  function openNew() {
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEdit(z: DeliveryZone) {
    setForm({ id: z.id, name: z.name, delivery_fee: z.delivery_fee, min_order: z.min_order });
    setShowForm(true);
  }

  async function save() {
    if (!form.name || form.delivery_fee === "") {
      alert("Име и цена за доставка са задължителни.");
      return;
    }
    const payload = {
      name: form.name,
      delivery_fee: Number(form.delivery_fee),
      min_order: Number(form.min_order || 0),
    };
    if (form.id) {
      await fetch(`/api/admin/zones/${form.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch("/api/admin/zones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
    setShowForm(false);
    const res = await fetch("/api/admin/zones");
    const data = await res.json();
    setZones(data.zones ?? []);
  }

  async function toggleActive(z: DeliveryZone) {
    await fetch(`/api/admin/zones/${z.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !z.active }),
    });
    setZones((prev) => prev.map((x) => (x.id === z.id ? { ...x, active: z.active ? 0 : 1 } : x)));
  }

  async function remove(id: number) {
    if (!confirm("Изтриване на зоната?")) return;
    await fetch(`/api/admin/zones/${id}`, { method: "DELETE" });
    setZones((prev) => prev.filter((z) => z.id !== id));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-display font-extrabold text-2xl">Зони за доставка във Варна</h1>
        <button onClick={openNew} className="bg-brand text-white rounded-xl px-4 py-2.5 font-semibold text-sm">
          + Нова зона
        </button>
      </div>

      <div className="grid gap-3">
        {zones.map((z) => (
          <div
            key={z.id}
            className="bg-surface rounded-2xl border border-border p-4 flex items-center justify-between gap-3 flex-wrap"
          >
            <div>
              <p className="font-semibold">{z.name}</p>
              <p className="text-xs text-muted">
                Доставка {formatPrice(z.delivery_fee)} · мин. поръчка {formatPrice(z.min_order)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => toggleActive(z)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full ${
                  z.active ? "bg-success/10 text-success" : "bg-black/5 text-muted"
                }`}
              >
                {z.active ? "Активна" : "Изключена"}
              </button>
              <button
                onClick={() => openEdit(z)}
                className="text-xs font-semibold px-3 py-1.5 rounded-full border border-border"
              >
                Редакция
              </button>
              <button
                onClick={() => remove(z.id)}
                className="text-xs font-semibold px-3 py-1.5 rounded-full border border-border text-brand"
              >
                Изтрий
              </button>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <button className="absolute inset-0 bg-black/50" onClick={() => setShowForm(false)} />
          <div className="relative bg-surface w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-bold text-lg">
                {form.id ? "Редакция на зона" : "Нова зона"}
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
                placeholder="Име на квартала (напр. Чайка)"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
              <input
                type="number"
                step="0.01"
                className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm"
                placeholder="Цена за доставка (€)"
                value={form.delivery_fee}
                onChange={(e) => setForm((f) => ({ ...f, delivery_fee: e.target.value }))}
              />
              <input
                type="number"
                step="0.01"
                className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm"
                placeholder="Минимална поръчка (€)"
                value={form.min_order}
                onChange={(e) => setForm((f) => ({ ...f, min_order: e.target.value }))}
              />
              <button onClick={save} className="w-full bg-brand text-white rounded-xl py-3 font-bold mt-2">
                Запази зоната
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
