"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatPrice } from "@/lib/format";
import { useCart } from "@/lib/cart-context";
import { useLocale, useT } from "@/lib/i18n/LocaleProvider";
import type { DictKey } from "@/lib/i18n/dict";
import type {
  CustomerPublic,
  CustomerAddress,
  Order,
  OrderItem,
  ProductWithOptions,
} from "@/lib/types";

type Tab = "profile" | "addresses" | "payment" | "orders";

export function AccountDashboard({
  customer,
  addresses: initialAddresses,
  orders,
  translations = {},
}: {
  translations?: Record<string, string>;
  customer: CustomerPublic;
  addresses: CustomerAddress[];
  orders: Order[];
}) {
  const router = useRouter();
  const t = useT();
  const [tab, setTab] = useState<Tab>("profile");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("tab");
    if (requested === "payment" || requested === "addresses" || requested === "orders") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
          {t("acc.tab.profile")}
        </TabButton>
        <TabButton active={tab === "addresses"} onClick={() => setTab("addresses")}>
          {t("acc.tab.addresses")}
        </TabButton>
        <TabButton active={tab === "payment"} onClick={() => setTab("payment")}>
          {t("acc.tab.cards")}
        </TabButton>
        <TabButton active={tab === "orders"} onClick={() => setTab("orders")}>
          {t("acc.tab.orders")}
        </TabButton>
      </div>

      {tab === "profile" && <ProfileTab customer={customer} onSaved={() => router.refresh()} />}
      {tab === "addresses" && <AddressesTab addresses={initialAddresses} />}
      {tab === "payment" && <PaymentMethodsTab />}
      {tab === "orders" && <OrdersTab orders={orders} translations={translations} />}
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
  const t = useT();
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
      {t("acc.logout")}
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
  const t = useT();
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
        <span className="text-xs text-muted">{t("acc.fullName")}</span>
        <input
          className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label className="block space-y-1">
        <span className="text-xs text-muted">{t("acc.phone")}</span>
        <input
          className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </label>
      <label className="block space-y-1">
        <span className="text-xs text-muted">{t("acc.email")}</span>
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
        {saving ? t("acc.saving") : t("acc.saveChanges")}
      </button>
      {saved && <p className="text-success text-sm font-semibold">{t("acc.saved")}</p>}
    </div>
  );
}

function AddressesTab({
  addresses: initial,
}: {
  addresses: CustomerAddress[];
}) {
  const t = useT();
  const [addresses, setAddresses] = useState(initial);
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState(t("acc.homeAddress"));
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
      setError(t("acc.fillRequired"));
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
      setError(data.error ?? t("acc.error"));
      return;
    }
    setLabel(t("acc.homeAddress"));
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
                  {t("acc.default")}
                </span>
              )}
            </div>
            <p className="text-sm text-muted">{a.address}</p>
            {a.quarter && <p className="text-xs text-muted">{a.quarter}</p>}
            {a.address_notes && <p className="text-xs text-muted">{a.address_notes}</p>}
            {a.intercom && <p className="text-xs text-muted">{t("acc.intercom")}: {a.intercom}</p>}
          </div>
          <div className="flex flex-col gap-1.5 shrink-0">
            {a.is_default !== 1 && (
              <button
                onClick={() => makeDefault(a.id)}
                className="text-xs font-semibold text-brand"
              >
                {t("acc.default")}
              </button>
            )}
            <button
              onClick={() => removeAddress(a.id)}
              className="text-xs font-semibold text-muted"
            >
              {t("acc.delete")}
            </button>
          </div>
        </div>
      ))}
      {addresses.length === 0 && !adding && (
        <p className="text-muted text-sm text-center py-8">{t("acc.noAddresses")}</p>
      )}

      {adding ? (
        <div className="bg-surface rounded-2xl border border-border p-4 space-y-3">
          <input
            className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm"
            placeholder={t("acc.addrLabelPh")}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <input
            className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm"
            placeholder={t("acc.quarter")}
            value={quarter}
            onChange={(e) => setQuarter(e.target.value)}
          />
          <div className="grid sm:grid-cols-[1fr_140px] gap-3">
            <input
              className="rounded-xl border border-border px-3.5 py-2.5 text-sm"
              placeholder={t("acc.street")}
              value={street}
              onChange={(e) => setStreet(e.target.value)}
            />
            <input
              className="rounded-xl border border-border px-3.5 py-2.5 text-sm"
              placeholder={t("acc.number")}
              value={houseNumber}
              onChange={(e) => setHouseNumber(e.target.value)}
            />
          </div>
          <input
            className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm"
            placeholder={t("acc.floorPh")}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <input
            className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm"
            placeholder={t("acc.intercomPh")}
            value={intercom}
            onChange={(e) => setIntercom(e.target.value)}
          />
          {error && <p className="text-sm text-brand font-semibold">{error}</p>}
          <div className="flex gap-2">
            <button onClick={addAddress} className="bg-brand text-white rounded-xl px-5 py-2.5 font-bold text-sm">
              {t("acc.saveAddress")}
            </button>
            <button
              onClick={() => setAdding(false)}
              className="rounded-xl border border-border px-5 py-2.5 font-semibold text-sm"
            >
              {t("acc.cancel")}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="w-full border-2 border-dashed border-border rounded-2xl py-4 text-sm font-semibold text-muted hover:border-brand hover:text-brand transition-colors"
        >
          {t("acc.addAddress")}
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

function PaymentMethodsTab() {
  const t = useT();
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, []);

  async function addCard() {
    setError("");
    setAddingCard(true);
    try {
      const res = await fetch("/api/account/payment-methods", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setError(data.error ?? t("acc.cardAddError"));
        setAddingCard(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError(t("acc.connError"));
      setAddingCard(false);
    }
  }

  async function removeCard(id: string) {
    setError("");
    setRemovingId(id);
    const res = await fetch(`/api/account/payment-methods/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? t("acc.cardRemoveError"));
    }
    setRemovingId(null);
    refresh();
  }

  return (
    <div className="space-y-3">
      {cards === null ? (
        <p className="text-muted text-sm text-center py-8">{t("acc.loading")}</p>
      ) : cards.length === 0 ? (
        <p className="text-muted text-sm text-center py-8">{t("acc.noCards")}</p>
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
                  {t("acc.validUntil")} {String(c.expMonth).padStart(2, "0")}/{c.expYear}
                </p>
              </div>
            </div>
            <button
              onClick={() => removeCard(c.id)}
              disabled={removingId === c.id}
              className="text-xs font-semibold text-muted disabled:opacity-50 shrink-0"
            >
              {removingId === c.id ? t("acc.removing") : t("acc.delete")}
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
        {addingCard ? t("acc.opening") : t("acc.addCard")}
      </button>
      <p className="text-xs text-muted text-center">
        {t("acc.cardNote")}
      </p>
    </div>
  );
}

function orderItemLines(itemsJson: string, tx: (s: string) => string): string[] {
  try {
    const items: OrderItem[] = JSON.parse(itemsJson);
    return items.map((i) => `${i.quantity}× ${tx(i.name)}`);
  } catch {
    return [];
  }
}

const ITEM_LINES_COLLAPSED = 3;

function OrdersTab({
  orders,
  translations,
}: {
  orders: Order[];
  translations: Record<string, string>;
}) {
  const t = useT();
  const { locale } = useLocale();
  const tx = (text: string) => translations[text.trim()] ?? text;
  const { addLine, openDrawer } = useCart();
  const router = useRouter();
  const [reorderingId, setReorderingId] = useState<number | null>(null);
  const [skipped, setSkipped] = useState<{ orderId: number; names: string[] } | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());

  function splitList(text: string): string[] {
    return text
      .split(",")
      .map((x) => x.trim().replace(/\.$/, ""))
      .filter(Boolean);
  }

  function localRemoved(product: ProductWithOptions, removed: string[]): string[] {
    const bg = splitList(product.description_bg ?? "");
    const local = splitList(product.description);
    if (bg.length > 0 && bg.length === local.length) {
      return removed.map((x) => {
        const i = bg.indexOf(x);
        return i >= 0 ? local[i] : tx(x);
      });
    }
    return removed.map(tx);
  }

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
        skippedNames.push(tx(item.name));
        continue;
      }
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
          .map((e) => ({ id: e.id!, name: tx(e.name), price: e.price, optionId: e.optionId })),
        removedIngredients: item.removed ? localRemoved(product, item.removed) : undefined,
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
    return <p className="text-muted text-sm text-center py-10">{t("acc.noOrders")}</p>;
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
                  {new Date(o.created_at).toLocaleDateString(locale === "en" ? "en-GB" : "bg-BG", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </div>
              <div className="text-right">
                <span className="font-bold text-brand block">{formatPrice(o.total)}</span>
                <span className="text-xs font-semibold text-muted">{t(`order.status.${o.status}` as DictKey)}</span>
              </div>
            </div>
          </Link>
          {(() => {
            const lines = orderItemLines(o.items_json, tx);
            if (lines.length === 0) return null;
            const isExpanded = expandedItems.has(o.id);
            const visibleLines = isExpanded ? lines : lines.slice(0, ITEM_LINES_COLLAPSED);
            const hiddenCount = lines.length - visibleLines.length;
            return (
              <div className="mt-2 text-sm text-muted space-y-0.5">
                {visibleLines.map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
                {hiddenCount > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedItems((prev) => {
                        const next = new Set(prev);
                        next.add(o.id);
                        return next;
                      })
                    }
                    className="text-brand font-semibold text-xs pt-0.5"
                  >
                    {t("acc.showMore")} ({hiddenCount})
                  </button>
                )}
                {isExpanded && lines.length > ITEM_LINES_COLLAPSED && (
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedItems((prev) => {
                        const next = new Set(prev);
                        next.delete(o.id);
                        return next;
                      })
                    }
                    className="text-brand font-semibold text-xs pt-0.5"
                  >
                    {t("acc.hide")}
                  </button>
                )}
              </div>
            );
          })()}
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
            {reorderingId === o.id ? t("acc.loading") : t("acc.reorder")}
          </button>
          {skipped?.orderId === o.id && (
            <p className="mt-2 text-xs text-muted">
              {t(skipped.names.length === 1 ? "acc.skippedOne" : "acc.skippedMany").replace("{names}", skipped.names.join(", "))}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
