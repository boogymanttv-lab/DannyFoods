"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatPrice } from "@/lib/format";
import { useCart } from "@/lib/cart-context";
import type {
  CustomerPublic,
  CustomerAddress,
  Order,
  OrderItem,
  OrderStatus,
  ProductWithOptions,
} from "@/lib/types";

const STATUS_LABELS: Record<OrderStatus, string> = {
  new: "Приета",
  confirmed: "Потвърдена",
  preparing: "Приготвя се",
  delivering: "На път е",
  delivered: "Доставена",
  cancelled: "Отказана",
};

type Tab = "profile" | "addresses" | "payment" | "orders";

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

  // Returning here from the "add a card" Stripe redirect (?tab=payment)
  // should land straight back on that tab instead of the default Profile
  // one — read directly from the URL rather than useSearchParams so this
  // component doesn't need a Suspense boundary just for this.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("tab");
    if (requested === "payment" || requested === "addresses" || requested === "orders") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from the URL on mount, not a render loop
      setTab(requested);
    }
  }, []);

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
        <TabButton active={tab === "payment"} onClick={() => setTab("payment")}>
          Карти
        </TabButton>
        <TabButton active={tab === "orders"} onClick={() => setTab("orders")}>
          Поръчки
        </TabButton>
      </div>

      {tab === "profile" && <ProfileTab customer={customer} onSaved={() => router.refresh()} />}
      {tab === "addresses" && <AddressesTab addresses={initialAddresses} />}
      {tab === "payment" && <PaymentMethodsTab />}
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
      className="rounded-xl border border-border bg-black/5 px-4 py-2 text-sm font-semibold text-foreground hover:bg-black/10 transition-colors"
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

type SavedCard = {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
};

const CARD_BRAND_LABELS: Record<string, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "American Express",
  discover: "Discover",
  diners: "Diners Club",
  jcb: "JCB",
  unionpay: "UnionPay",
};

// Saved cards live entirely in Stripe (see src/lib/stripe-customer.ts) — this
// tab never handles raw card numbers itself. "Добави карта" redirects to a
// Stripe-hosted setup form (same pattern as the checkout card-payment
// redirect) and lands back here; a card also gets saved automatically the
// first time this customer pays by card at checkout.
function PaymentMethodsTab() {
  const [cards, setCards] = useState<SavedCard[] | null>(null);
  const [error, setError] = useState("");
  const [addingCard, setAddingCard] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function refresh() {
    try {
      const res = await fetch("/api/account/payment-methods");
      const data = await res.json();
      setCards(data.cards ?? []);
    } catch {
      setCards([]);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch on mount, same pattern as other tabs' data loads
    refresh();
  }, []);

  async function addCard() {
    setError("");
    setAddingCard(true);
    try {
      const res = await fetch("/api/account/payment-methods", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setError(data.error ?? "Грешка при добавяне на картата.");
        setAddingCard(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Грешка при връзката със сървъра.");
      setAddingCard(false);
    }
  }

  async function removeCard(id: string) {
    setError("");
    setRemovingId(id);
    const res = await fetch(`/api/account/payment-methods/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Грешка при премахване на картата.");
    }
    setRemovingId(null);
    refresh();
  }

  return (
    <div className="space-y-3">
      {cards === null ? (
        <p className="text-muted text-sm text-center py-8">Зареждане...</p>
      ) : cards.length === 0 ? (
        <p className="text-muted text-sm text-center py-8">Нямаш запазени карти.</p>
      ) : (
        cards.map((c) => (
          <div
            key={c.id}
            className="bg-surface rounded-2xl border border-border p-4 flex justify-between items-center gap-3"
          >
            <div className="flex items-center gap-3">
              <span className="h-10 w-14 rounded-lg bg-black/5 grid place-items-center text-lg" aria-hidden>
                💳
              </span>
              <div>
                <p className="font-semibold">
                  {CARD_BRAND_LABELS[c.brand] ?? c.brand} •••• {c.last4}
                </p>
                <p className="text-xs text-muted">
                  Валидна до {String(c.expMonth).padStart(2, "0")}/{c.expYear}
                </p>
              </div>
            </div>
            <button
              onClick={() => removeCard(c.id)}
              disabled={removingId === c.id}
              className="text-xs font-semibold text-muted disabled:opacity-50 shrink-0"
            >
              {removingId === c.id ? "Премахване..." : "Изтрий"}
            </button>
          </div>
        ))
      )}

      {error && <p className="text-sm text-brand font-semibold">{error}</p>}

      <button
        onClick={addCard}
        disabled={addingCard}
        className="w-full border-2 border-dashed border-border rounded-2xl py-4 text-sm font-semibold text-muted hover:border-brand hover:text-brand transition-colors disabled:opacity-50"
      >
        {addingCard ? "Отваряне..." : "+ Добави карта"}
      </button>
      <p className="text-xs text-muted text-center">
        Данните на картата се въвеждат директно при Stripe — никога не минават през нашия сървър.
      </p>
    </div>
  );
}

function OrdersTab({ orders }: { orders: Order[] }) {
  const { addLine, openDrawer } = useCart();
  const router = useRouter();
  const [reorderingId, setReorderingId] = useState<number | null>(null);
  const [skipped, setSkipped] = useState<{ orderId: number; names: string[] } | null>(null);

  // Rebuilds the exact cart lines from a past order's stored items_json —
  // relies on sizeId/extras[].id/optionId (added alongside quick-reorder)
  // rather than re-matching by display name/label text, which could break
  // if a product's wording changed since the order was placed. Each line's
  // product is re-fetched live (GET /api/products/[id]) so the cart shows
  // the product's CURRENT photo (the order snapshot never stored one) and
  // so a product/size/extra removed from the menu since this order was
  // placed is quietly dropped instead of silently added with stale data —
  // the customer sees which items didn't make it back into the cart.
  async function reorder(o: Order): Promise<boolean> {
    let items: OrderItem[];
    try {
      items = JSON.parse(o.items_json);
    } catch {
      return false;
    }
    setReorderingId(o.id);
    setSkipped(null);
    const skippedNames: string[] = [];
    // Cache product lookups — a repeated item in the same order (or the
    // same product across a couple of orders) shouldn't refetch.
    const cache = new Map<number, ProductWithOptions | null>();
    for (const item of items) {
      let product = cache.get(item.productId);
      if (product === undefined) {
        const fetched: ProductWithOptions | null = await fetch(`/api/products/${item.productId}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => d?.product ?? null)
          .catch(() => null);
        product = fetched;
        cache.set(item.productId, product);
      }
      if (!product) {
        skippedNames.push(item.name);
        continue;
      }
      // If the size this line was ordered at no longer exists, fall back to
      // the product's current default size rather than dropping the whole
      // line — still orderable, just possibly a different size than before.
      const size = item.sizeId ? product.sizes.find((s) => s.id === item.sizeId) : undefined;
      const fallbackSize = !size && item.sizeId ? product.sizes.find((s) => s.is_default) ?? product.sizes[0] : undefined;
      const resolvedSize = size ?? fallbackSize;
      addLine({
        productId: product.id,
        name: product.name,
        image: product.image,
        sizeLabel: resolvedSize?.label,
        sizeId: resolvedSize?.id,
        unitPrice: resolvedSize ? product.base_price + resolvedSize.price_delta : product.base_price,
        quantity: item.quantity,
        extras: item.extras
          .filter((e) => e.id != null && product!.extras.some((pe) => pe.id === e.id))
          .map((e) => ({ id: e.id!, name: e.name, price: e.price, optionId: e.optionId })),
        removedIngredients: item.removed,
      });
    }
    setReorderingId(null);
    if (skippedNames.length > 0) {
      setSkipped({ orderId: o.id, names: skippedNames });
    }
    const addedAny = skippedNames.length < items.length;
    if (addedAny) {
      openDrawer();
    }
    return addedAny;
  }

  if (orders.length === 0) {
    return <p className="text-muted text-sm text-center py-10">Нямаш направени поръчки все още.</p>;
  }
  return (
    <div className="space-y-3">
      {orders.map((o) => (
        <div
          key={o.id}
          className="bg-surface rounded-2xl border border-border p-4 hover:shadow-md transition-shadow"
        >
          <Link href={`/order/${o.order_number}`} className="block">
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
          <button
            type="button"
            disabled={reorderingId === o.id}
            onClick={async (e) => {
              e.preventDefault();
              const added = await reorder(o);
              if (added) router.push("/checkout");
            }}
            className="mt-3 w-full rounded-xl border border-brand text-brand font-semibold text-sm py-2 hover:bg-brand/5 transition-colors disabled:opacity-60"
          >
            {reorderingId === o.id ? "Зареждане..." : "🔁 Поръчай отново"}
          </button>
          {skipped?.orderId === o.id && (
            <p className="mt-2 text-xs text-muted">
              {skipped.names.join(", ")} вече {skipped.names.length === 1 ? "не е наличен" : "не са налични"} и не{" "}
              {skipped.names.length === 1 ? "беше добавен" : "бяха добавени"} в количката.
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
