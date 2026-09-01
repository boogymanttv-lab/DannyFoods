"use client";

import { useState } from "react";
import type { AdminUserPublic, AdminStation } from "@/lib/repos/admin";

const STATION_LABELS: Record<AdminStation, string> = {
  all: "Всичко",
  pizza: "Само пици",
  other: "Всичко без пици",
};

const emptyForm = {
  id: null as number | null,
  name: "",
  email: "",
  password: "",
  station: "all" as AdminStation,
};

export function StaffManager({ initialStaff }: { initialStaff: AdminUserPublic[] }) {
  const [staff, setStaff] = useState(initialStaff);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");

  function openNew() {
    setForm(emptyForm);
    setError("");
    setShowForm(true);
  }

  async function refresh() {
    const res = await fetch("/api/admin/staff");
    const data = await res.json();
    setStaff(data.staff ?? []);
  }

  async function save() {
    if (!form.name || !form.email || !form.password) {
      setError("Име, имейл и парола са задължителни.");
      return;
    }
    const res = await fetch("/api/admin/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Грешка");
      return;
    }
    setShowForm(false);
    await refresh();
  }

  async function changeStation(id: number, station: AdminStation) {
    await fetch(`/api/admin/staff/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ station }),
    });
    setStaff((prev) => prev.map((s) => (s.id === id ? { ...s, station } : s)));
  }

  async function remove(id: number) {
    if (!confirm("Изтриване на служителя? Той вече няма да може да влиза в админ панела.")) return;
    await fetch(`/api/admin/staff/${id}`, { method: "DELETE" });
    setStaff((prev) => prev.filter((s) => s.id !== id));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display font-extrabold text-2xl">Служители</h1>
          <p className="text-sm text-muted mt-1 max-w-xl">
            Служителски профили виждат само страницата Поръчки — не и Продукти, Настройки и
            останалите раздели. &quot;Станция&quot; определя кои артикули от поръчката им се
            показват открояени, а кои приглушени, и коя готовност могат да отбелязват.
          </p>
        </div>
        <button
          onClick={openNew}
          className="bg-brand text-white rounded-xl px-4 py-2.5 font-semibold text-sm shrink-0"
        >
          + Нов служител
        </button>
      </div>

      <div className="grid gap-3">
        {staff.map((s) => (
          <div
            key={s.id}
            className="bg-surface rounded-2xl border border-border p-4 flex items-center justify-between gap-3 flex-wrap"
          >
            <div>
              <p className="font-semibold">{s.name}</p>
              <p className="text-xs text-muted">{s.email}</p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={s.station}
                onChange={(e) => changeStation(s.id, e.target.value as AdminStation)}
                className="text-xs font-semibold rounded-full border border-border px-3 py-1.5"
              >
                {(Object.keys(STATION_LABELS) as AdminStation[]).map((st) => (
                  <option key={st} value={st}>
                    {STATION_LABELS[st]}
                  </option>
                ))}
              </select>
              <button
                onClick={() => remove(s.id)}
                className="text-xs font-semibold px-3 py-1.5 rounded-full border border-border text-brand"
              >
                Изтрий
              </button>
            </div>
          </div>
        ))}
        {staff.length === 0 && (
          <p className="text-muted text-sm text-center py-10">Все още няма добавени служители.</p>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <button className="absolute inset-0 bg-black/50" onClick={() => setShowForm(false)} />
          <div className="relative bg-surface w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-bold text-lg">Нов служител</h2>
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
                placeholder="Име"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
              <input
                type="email"
                className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm"
                placeholder="Имейл (за вход)"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
              <input
                type="password"
                className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm"
                placeholder="Парола"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              />
              <select
                className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm"
                value={form.station}
                onChange={(e) =>
                  setForm((f) => ({ ...f, station: e.target.value as AdminStation }))
                }
              >
                {(Object.keys(STATION_LABELS) as AdminStation[]).map((st) => (
                  <option key={st} value={st}>
                    {STATION_LABELS[st]}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted">
                Служителят влиза на /admin/login с този имейл и парола.
              </p>
              {error && <p className="text-sm text-brand font-semibold">{error}</p>}
              <button onClick={save} className="w-full bg-brand text-white rounded-xl py-3 font-bold mt-2">
                Запази служителя
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
