"use client";

import { useState } from "react";
import { formatPrice } from "@/lib/format";
import type { Promotion } from "@/lib/types";

const emptyForm = {
  id: null as number | null,
  code: "",
  description: "",
  discount_type: "percent" as "percent" | "fixed",
  discount_value: "" as string | number,
  min_order: "0" as string | number,
  starts_at: "",
  ends_at: "",
  usage_limit: "" as string | number,
};

export function PromotionsManager({ initialPromotions }: { initialPromotions: Promotion[] }) {
  const [promotions, setPromotions] = useState(initialPromotions);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);

  function openNew() {
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEdit(p: Promotion) {
    setForm({
      id: p.id,
      code: p.code,
      description: p.description,
      discount_type: p.discount_type,
      discount_value: p.discount_value,
      min_order: p.min_order,
      starts_at: p.starts_at ? p.starts_at.slice(0, 10) : "",
      ends_at: p.ends_at ? p.ends_at.slice(0, 10) : "",
      usage_limit: p.usage_limit ?? "",
    });
    setShowForm(true);
  }

  async function save() {
    if (!form.code || form.discount_value === "") {
      alert("Код и стойност на отстъпката са задължителни.");
      return;
    }
    const payload = {
      code: form.code,
      description: form.description,
      discount_type: form.discount_type,
      discount_value: Number(form.discount_value),
      min_order: Number(form.min_order || 0),
      starts_at: form.starts_at || null,
      ends_at: form.ends_at || null,
      usage_limit: form.usage_limit ? Number(form.usage_limit) : null,
    };
    if (form.id) {
      await fetch(`/api/admin/promotions/${form.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      const res = await fetch("/api/admin/promotions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error ?? "Грешка");
        return;
      }
    }
    setShowForm(false);
    const res = await fetch("/api/admin/promotions");
    const data = await res.json();
    setPromotions(data.promotions ?? []);
  }

  async function toggleActive(p: Promotion) {
    await fetch(`/api/admin/promotions/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !p.active }),
    });
    setPromotions((prev) =>
      prev.map((x) => (x.id === p.id ? { ...x, active: p.active ? 0 : 1 } : x))
    );
  }

  async function remove(id: number) {
    if (!confirm("Изтриване на промоцията?")) return;
    await fetch(`/api/admin/promotions/${id}`, { method: "DELETE" });
    setPromotions((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-display font-extrabold text-2xl">Промоции</h1>
        <button onClick={openNew} className="bg-brand text-white rounded-xl px-4 py-2.5 font-semibold text-sm">
          + Нов промо код
        </button>
      </div>

      <div className="grid gap-3">
        {promotions.map((p) => (
          <div
            key={p.id}
            className="bg-surface rounded-2xl border border-border p-4 flex items-center justify-between gap-3 flex-wrap"
          >
            <div>
              <p className="font-semibold">
                {p.code}{" "}
                <span className="text-sm font-normal text-muted">
                  —{" "}
                  {p.discount_type === "percent"
                    ? `${p.discount_value}%`
                    : formatPrice(p.discount_value)}{" "}
                  отстъпка
                </span>
              </p>
              <p className="text-xs text-muted mt-0.5">
                {p.description || "Без описание"} · мин. поръчка {formatPrice(p.min_order)} ·
                използван {p.used_count}
                {p.usage_limit != null ? `/${p.usage_limit}` : ""} пъти
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => toggleActive(p)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full ${
                  p.active ? "bg-success/10 text-success" : "bg-black/5 text-muted"
                }`}
              >
                {p.active ? "Активна" : "Изключена"}
              </button>
              <button
                onClick={() => openEdit(p)}
                className="text-xs font-semibold px-3 py-1.5 rounded-full border border-border"
              >
                Редакция
              </button>
              <button
                onClick={() => remove(p.id)}
                className="text-xs font-semibold px-3 py-1.5 rounded-full border border-border text-brand"
              >
                Изтрий
              </button>
            </div>
          </div>
        ))}
        {promotions.length === 0 && (
          <p className="text-muted text-sm text-center py-10">Все още няма промоции.</p>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <button className="absolute inset-0 bg-black/50" onClick={() => setShowForm(false)} />
          <div className="relative bg-surface w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-bold text-lg">
                {form.id ? "Редакция на промоция" : "Нов промо код"}
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
                className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm uppercase"
                placeholder="Код (напр. VARNA10)"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              />
              <input
                className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm"
                placeholder="Описание"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
              <div className="grid grid-cols-2 gap-3">
                <select
                  className="rounded-xl border border-border px-3.5 py-2.5 text-sm"
                  value={form.discount_type}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      discount_type: e.target.value as "percent" | "fixed",
                    }))
                  }
                >
                  <option value="percent">Процент %</option>
                  <option value="fixed">Фиксирана сума €</option>
                </select>
                <input
                  type="number"
                  step="0.01"
                  className="rounded-xl border border-border px-3.5 py-2.5 text-sm"
                  placeholder="Стойност"
                  value={form.discount_value}
                  onChange={(e) => setForm((f) => ({ ...f, discount_value: e.target.value }))}
                />
              </div>
              <input
                type="number"
                step="0.01"
                className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm"
                placeholder="Минимална поръчка (€)"
                value={form.min_order}
                onChange={(e) => setForm((f) => ({ ...f, min_order: e.target.value }))}
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted">Начало (по желание)</label>
                  <input
                    type="date"
                    className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm"
                    value={form.starts_at}
                    onChange={(e) => setForm((f) => ({ ...f, starts_at: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted">Край (по желание)</label>
                  <input
                    type="date"
                    className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm"
                    value={form.ends_at}
                    onChange={(e) => setForm((f) => ({ ...f, ends_at: e.target.value }))}
                  />
                </div>
              </div>
              <input
                type="number"
                className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm"
                placeholder="Лимит на използвания (по желание)"
                value={form.usage_limit}
                onChange={(e) => setForm((f) => ({ ...f, usage_limit: e.target.value }))}
              />
              <button onClick={save} className="w-full bg-brand text-white rounded-xl py-3 font-bold mt-2">
                Запази промоцията
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
