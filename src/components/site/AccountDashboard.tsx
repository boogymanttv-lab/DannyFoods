"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatPrice } from "@/lib/format";
import type { CustomerPublic, CustomerAddress, Order, OrderStatus } from "@/lib/types";

const STATUS_LABELS: Record<OrderStatus, string> = {
  new: "Приета",
  confirmed: "Потвърдена",
  preparing: "Приготвя се",
  delivering: "На път е",
  delivered: "Доставена",
  cancelled: "Отказана",
};

type Tab = "profile" | "addresses" | "orders";

export function AccountDashboard({
  customer,
  addresses: initialAddresses,
  orders,
}: {
  customer: CustomerPublic;
  addresses: CustomerAddress[];
  orders: Order[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("profile");

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          {customer.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={customer.avatar_url} alt={customer.name} className="h-12 w-12 rounded-full object-cover" />
          ) : (
            <div className="h-12 w-12 rounded-full bg-brand text-white grid place-items-center font-display font-extrabold text-lg">
              {customer.name.slice(0, 1)}
            </div>
          )}
          <div>
            <h1 className="font-display font-extrabold text-xl">{customer.name}</h1>
            <p className="text-sm text-muted">{customer.email}</p>
          </div>
        </div>
        <LogoutButton />
      </div>

      <div className="flex gap-2">
        <TabButton active={tab === "profile"} onClick={() => setTab("profile")}>
          Профил
        </TabButton>
        <TabButton active={tab === "addresses"} onClick={() => setTab("addresses")}>
          Адреси
        </TabButton>
        <TabButton active={tab === "orders"} onClick={() => setTab("orders")}>
          Поръчки
        </TabButton>
      </div>

      {tab === "profile" && <ProfileTab customer={customer} onSaved={() => router.refresh()} />}
      {tab === "addresses" && <AddressesTab addresses={initialAddresses} />}
      {tab === "orders" && <OrdersTab orders={orders} />}
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
      className={`rounded-full px-4 py-2 text-sm font-semibold border transition-colors ${
        active ? "bg-brand text-white border-brand" : "bg-surface border-border text-foreground/70"
      }`}
    >
      {children}
    </button>
  );
}

function LogoutButton() {
  const router = useRouter();
  async function logout() {
    await fetch("/api/account/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }
  return (
    <button
      onClick={logout}
      className="rounded-xl border border-border px-4 py-2 text-sm font-semibold hover:bg-black/5 transition-colors"
    >
      Изход
    </button>
  );
}

function ProfileTab({
  customer,
  onSaved,
}: {
  customer: CustomerPublic;
  onSaved: () => void;
}) {
  const [name, setName] = useState(customer.name);
  const [phone, setPhone] = useState(customer.phone);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    await fetch("/api/account/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone }),
    });
    setSaving(false);
    setSaved(true);
    onSaved();
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="bg-surface rounded-2xl border border-border p-5 space-y-3 max-w-md">
      <label className="block space-y-1">
        <span className="text-xs text-muted">Име и фамилия</span>
        <input
          className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label className="block space-y-1">
        <span className="text-xs text-muted">Телефон</span>
        <input
          className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </label>
      <label className="block space-y-1">
        <span className="text-xs text-muted">Имейл</span>
        <input
          disabled
          className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm bg-black/5 text-muted"
          value={customer.email}
        />
      </label>
      <button
        onClick={save}
        disabled={saving}
        className="bg-brand text-white rounded-xl px-5 py-2.5 font-bold text-sm disabled:opacity-60"
      >
        {saving ? "Запазване..." : "Запази промените"}
      </button>
      {saved && <p className="text-success text-sm font-semibold">Запазено ✔</p>}
    </div>
  );
}

function AddressesTab({
  addresses: initial,
}: {
  addresses: CustomerAddress[];
}) {
  const [addresses, setAddresses] = useState(initial);
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("Домашен адрес");
  const [quarter, setQuarter] = useState("");
  const [street, setStreet] = useState("");
  const [houseNumber, setHouseNumber] = useState("");
  const [intercom, setIntercom] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  async function refresh() {
    const res = await fetch("/api/account/addresses");
    const data = await res.json();
    setAddresses(data.addresses ?? []);
  }

  async function addAddress() {
    setError("");
    if (!label.trim() || !quarter.trim() || !street.trim() || !houseNumber.trim()) {
      setError("Моля, попълнете всички задължителни полета.");
      return;
    }
    const res = await fetch("/api/account/addresses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label,
        quarter,
        street,
        house_number: houseNumber,
        intercom,
        address_notes: notes,
        is_default: addresses.length === 0,
      }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Грешка");
      return;
    }
    setLabel("Домашен адрес");
    setQuarter("");
    setStreet("");
    setHouseNumber("");
    setIntercom("");
    setNotes("");
    setAdding(false);
    refresh();
  }

  async function removeAddress(id: number) {
    await fetch(`/api/account/addresses/${id}`, { method: "DELETE" });
    refresh();
  }

  async function makeDefault(id: number) {
    await fetch(`/api/account/addresses/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_default: true }),
    });
    refresh();
  }

  return (
    <div className="space-y-3">
      {addresses.map((a) => (
        <div key={a.id} className="bg-surface rounded-2xl border border-border p-4 flex justify-between items-start gap-3">
          <div>
            <div className="flex items-center gap-2">
              <p className="font-semibold">{a.label}</p>
              {a.is_default === 1 && (
                <span className="text-[10px] font-bold bg-gold/20 text-gold px-2 py-0.5 rounded-full">
                  По подразбиране
                </span>
              )}
            </div>
            <p className="text-sm text-muted">{a.address}</p>
            {a.quarter && <p className="text-xs text-muted">{a.quarter}</p>}
            {a.address_notes && <p className="text-xs text-muted">{a.address_notes}</p>}
            {a.intercom && <p className="text-xs text-muted">Звънец: {a.intercom}</p>}
          </div>
          <div className="flex flex-col gap-1.5 shrink-0">
            {a.is_default !== 1 && (
              <button
                onClick={() => makeDefault(a.id)}
                className="text-xs font-semibold text-brand"
              >
                По подразбиране
              </button>
            )}
            <button
              onClick={() => removeAddress(a.id)}
              className="text-xs font-semibold text-muted"
            >
              Изтрий
            </button>
          </div>
        </div>
      ))}
      {addresses.length === 0 && !adding && (
        <p className="text-muted text-sm text-center py-8">Нямаш запазени адреси.</p>
      )}

      {adding ? (
        <div className="bg-surface rounded-2xl border border-border p-4 space-y-3">
          <input
            className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm"
            placeholder="Име на адреса (напр. Вкъщи, Офис)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <input
            className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm"
            placeholder="Квартал"
            value={quarter}
            onChange={(e) => setQuarter(e.target.value)}
          />
          <div className="grid sm:grid-cols-[1fr_140px] gap-3">
            <input
              className="rounded-xl border border-border px-3.5 py-2.5 text-sm"
              placeholder="Улица"
              value={street}
              onChange={(e) => setStreet(e.target.value)}
            />
            <input
              className="rounded-xl border border-border px-3.5 py-2.5 text-sm"
              placeholder="Номер"
              value={houseNumber}
              onChange={(e) => setHouseNumber(e.target.value)}
            />
          </div>
          <input
            className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm"
            placeholder="Етаж, блок, апартамент (по желание)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <input
            className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm"
            placeholder="Звънец — име/номер на табло (по желание)"
            value={intercom}
            onChange={(e) => setIntercom(e.target.value)}
          />
          {error && <p className="text-sm text-brand font-semibold">{error}</p>}
          <div className="flex gap-2">
            <button onClick={addAddress} className="bg-brand text-white rounded-xl px-5 py-2.5 font-bold text-sm">
              Запази адреса
            </button>
            <button
              onClick={() => setAdding(false)}
              className="rounded-xl border border-border px-5 py-2.5 font-semibold text-sm"
            >
              Отказ
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="w-full border-2 border-dashed border-border rounded-2xl py-4 text-sm font-semibold text-muted hover:border-brand hover:text-brand transition-colors"
        >
          + Добави адрес
        </button>
      )}
    </div>
  );
}

function OrdersTab({ orders }: { orders: Order[] }) {
  if (orders.length === 0) {
    return <p className="text-muted text-sm text-center py-10">Нямаш направени поръчки все още.</p>;
  }
  return (
    <div className="space-y-3">
      {orders.map((o) => (
        <Link
          key={o.id}
          href={`/order/${o.order_number}`}
          className="block bg-surface rounded-2xl border border-border p-4 hover:shadow-md transition-shadow"
        >
          <div className="flex justify-between items-start gap-2">
            <div>
              <p className="font-semibold">{o.order_number}</p>
              <p className="text-xs text-muted">
                {new Date(o.created_at).toLocaleDateString("bg-BG", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
            <div className="text-right">
              <span className="font-bold text-brand block">{formatPrice(o.total)}</span>
              <span className="text-xs font-semibold text-muted">{STATUS_LABELS[o.status]}</span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
