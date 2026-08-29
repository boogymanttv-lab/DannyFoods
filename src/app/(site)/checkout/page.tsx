"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCart } from "@/lib/cart-context";
import { formatPrice } from "@/lib/format";
import type { DeliverySlot } from "@/lib/delivery-slots";
import type { CustomerAddress, OrderType } from "@/lib/types";

function slotKey(s: DeliverySlot): string {
  return `${s.date}|${s.time}`;
}

export default function CheckoutPage() {
  const { lines, subtotal, keyOf, clear } = useCart();
  const router = useRouter();

  const [orderType, setOrderType] = useState<OrderType>("delivery");
  const [quarter, setQuarter] = useState("");
  // Flat checkout pricing rules, loaded from /api/delivery-slots (see the
  // effect below) — configurable in Настройки rather than per-neighborhood.
  const [deliveryFeeFlat, setDeliveryFeeFlat] = useState(2.5);
  const [freeDeliveryOver, setFreeDeliveryOver] = useState(0);
  const [minOrderGlobal, setMinOrderGlobal] = useState(0);
  const [pickupAddress, setPickupAddress] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [street, setStreet] = useState("");
  const [houseNumber, setHouseNumber] = useState("");
  const [intercom, setIntercom] = useState("");
  const [addressNotes, setAddressNotes] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card_on_delivery" | "stripe">(
    "cash"
  );
  const [promoInput, setPromoInput] = useState("");
  const [promoApplied, setPromoApplied] = useState<{ code: string; discount: number } | null>(
    null
  );
  const [promoError, setPromoError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [loggedIn, setLoggedIn] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<CustomerAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<number | "new">("new");
  // Guards against a real race: the "load my saved addresses" request is
  // async and can resolve AFTER the customer has already picked "+ Нов
  // адрес" and started typing a different address. Without this, that late
  // response would silently reset selectedAddressId/street/houseNumber back
  // to the saved default — the customer sees and submits a form that looks
  // like it has their typed address, but the default gets applied under it
  // moments later and wins, so the order goes out to the OLD saved address
  // instead. Any explicit address action (picking a saved one, switching to
  // "new") flips this so the slow response is ignored once it arrives.
  const addressTouchedRef = useRef(false);

  const [deliveryTiming, setDeliveryTiming] = useState<"asap" | "scheduled">("asap");
  const [availableSlots, setAvailableSlots] = useState<DeliverySlot[]>([]);
  const [selectedSlotKey, setSelectedSlotKey] = useState("");
  const [shopOpenNow, setShopOpenNow] = useState(true);

  useEffect(() => {
    fetch("/api/delivery-slots")
      .then((r) => r.json())
      .then((d) => {
        const slots: DeliverySlot[] = d.slots ?? [];
        setAvailableSlots(slots);
        if (slots.length) setSelectedSlotKey(slotKey(slots[0]));
        // The shop is currently closed — ASAP isn't a real option (there's
        // no one to prepare the order right now), so force "pick a time"
        // and default it to the earliest slot, which will already be
        // tomorrow's opening if today has nothing left.
        if (!d.isOpenNow) setDeliveryTiming("scheduled");
        setShopOpenNow(Boolean(d.isOpenNow));
        if (typeof d.deliveryFeeFlat === "number") setDeliveryFeeFlat(d.deliveryFeeFlat);
        if (typeof d.freeDeliveryOver === "number") setFreeDeliveryOver(d.freeDeliveryOver);
        if (typeof d.minOrderGlobal === "number") setMinOrderGlobal(d.minOrderGlobal);
        if (d.pickupAddress) setPickupAddress(d.pickupAddress);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    // Guests get { loggedIn: false } here — this endpoint is public on
    // purpose so checkout works exactly the same whether or not the
    // shopper has an account.
    fetch("/api/account/session")
      .then((r) => r.json())
      .then((d) => {
        if (!d.loggedIn) return;
        setLoggedIn(true);
        setName(d.customer.name);
        setPhone(d.customer.phone ?? "");
        const addresses: CustomerAddress[] = d.addresses ?? [];
        setSavedAddresses(addresses);
        // If the customer already made an explicit address choice while
        // this request was in flight, respect that instead of overwriting
        // it with the default — see addressTouchedRef above.
        if (addressTouchedRef.current) return;
        const defaultAddr = addresses.find((a) => a.is_default === 1) ?? addresses[0];
        if (defaultAddr) {
          setSelectedAddressId(defaultAddr.id);
          setStreet(defaultAddr.street);
          setHouseNumber(defaultAddr.house_number);
          setIntercom(defaultAddr.intercom);
          setAddressNotes(defaultAddr.address_notes);
          setQuarter(defaultAddr.quarter ?? "");
        }
      })
      .catch(() => {
        // not logged in / request failed — checkout just proceeds as guest
      });
  }, []);

  function pickSavedAddress(id: number | "new") {
    addressTouchedRef.current = true;
    setSelectedAddressId(id);
    if (id === "new") {
      setStreet("");
      setHouseNumber("");
      setIntercom("");
      setAddressNotes("");
      setQuarter("");
      return;
    }
    const addr = savedAddresses.find((a) => a.id === id);
    if (addr) {
      setStreet(addr.street);
      setHouseNumber(addr.house_number);
      setIntercom(addr.intercom);
      setAddressNotes(addr.address_notes);
      setQuarter(addr.quarter ?? "");
    }
  }

  // While a saved address is picked, its street/number/notes/intercom are
  // shown read-only instead of as editable inputs — makes it visually clear
  // there's exactly one address in play (the one that gets submitted and
  // geocoded), not a separate "saved" one and a separate "typed" one.
  // Guarded by street/houseNumber actually having values: an address saved
  // before street/house_number existed as separate fields would otherwise
  // collapse into a summary showing a blank "Адрес:" and silently fail the
  // required-fields check with no visible reason — falling through to the
  // editable inputs instead (pre-filled with whatever IS there) always
  // leaves the customer able to see and fix what's missing.
  const usingSavedAddress =
    orderType === "delivery" &&
    selectedAddressId !== "new" &&
    street.trim() !== "" &&
    houseNumber.trim() !== "";

  const isPickup = orderType === "pickup";
  const deliveryFee = isPickup
    ? 0
    : freeDeliveryOver > 0 && subtotal >= freeDeliveryOver
      ? 0
      : deliveryFeeFlat;
  const discount = promoApplied?.discount ?? 0;
  const total = Math.max(0, subtotal + deliveryFee - discount);
  const meetsMinimum = minOrderGlobal > 0 ? subtotal >= minOrderGlobal : true;

  async function applyPromo() {
    setPromoError("");
    if (!promoInput.trim()) return;
    const res = await fetch("/api/promo/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: promoInput.trim(), subtotal }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setPromoError(data.error ?? "Невалиден код");
      setPromoApplied(null);
      return;
    }
    setPromoApplied({ code: promoInput.trim().toUpperCase(), discount: data.discount });
  }

  async function submitOrder() {
    setSubmitError("");
    if (!phone.trim()) {
      setSubmitError("Моля, попълнете всички задължителни полета.");
      return;
    }
    if (orderType === "delivery" && (!quarter.trim() || !street.trim() || !houseNumber.trim())) {
      setSubmitError("Моля, попълнете всички задължителни полета.");
      return;
    }
    if (!meetsMinimum) {
      setSubmitError(`Минималната поръчка е ${minOrderGlobal.toFixed(2)} €`);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: name,
          phone,
          order_type: orderType,
          ...(orderType === "delivery"
            ? {
                quarter,
                street,
                house_number: houseNumber,
                intercom,
                address_notes: addressNotes,
              }
            : {}),
          notes,
          promo_code: promoApplied?.code,
          payment_method: paymentMethod,
          requested_time:
            deliveryTiming === "scheduled" ? selectedSlotKey.replace("|", " ") : undefined,
          items: lines.map((l) => ({
            productId: l.productId,
            sizeId: l.sizeId,
            extras: l.extras.map((e) => ({ id: e.id, optionId: e.optionId })),
            removed: l.removedIngredients,
            quantity: l.quantity,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error ?? "Възникна грешка. Опитайте отново.");
        setSubmitting(false);
        return;
      }
      clear();
      router.push(data.redirectUrl);
    } catch {
      setSubmitError("Възникна грешка при връзката със сървъра.");
      setSubmitting(false);
    }
  }

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <p className="text-5xl mb-4">🛒</p>
        <h1 className="font-display font-bold text-xl mb-2">Количката е празна</h1>
        <p className="text-muted mb-6">Добавете продукти от менюто, за да продължите.</p>
        <Link href="/" className="inline-block bg-brand text-white rounded-xl px-6 py-3 font-bold">
          Към менюто
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 grid lg:grid-cols-[1fr_360px] gap-8">
      <div className="space-y-6">
        <h1 className="font-display font-extrabold text-2xl">Завършване на поръчката</h1>

        <div className="bg-surface rounded-2xl border border-border p-2 grid grid-cols-2 gap-2">
          {(
            [
              { value: "delivery", label: "🚴 Доставка" },
              { value: "pickup", label: "🏠 Вземи на място" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setOrderType(opt.value)}
              className={`rounded-xl py-3 text-sm font-bold transition-colors ${
                orderType === opt.value
                  ? "bg-brand text-white"
                  : "bg-transparent text-foreground/60"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="bg-surface rounded-2xl border border-border p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">
              {orderType === "delivery" ? "Данни за доставка" : "Данни за поръчката"}
            </h2>
            {!loggedIn && (
              <Link href="/account/login?redirect=/checkout" className="text-xs font-semibold text-brand">
                Вход за по-бързо поръчване →
              </Link>
            )}
          </div>

          {orderType === "delivery" && loggedIn && savedAddresses.length > 0 && (
            <div className="space-y-1">
              <label className="text-xs text-muted block">
                Зареди запазен адрес — попълва полетата по-долу вместо да пишеш отново:
              </label>
              <select
                className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm"
                value={selectedAddressId}
                onChange={(e) =>
                  pickSavedAddress(e.target.value === "new" ? "new" : Number(e.target.value))
                }
              >
                {savedAddresses.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label} ({a.address})
                  </option>
                ))}
                <option value="new">+ Нов адрес (въведи ръчно)</option>
              </select>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-3">
            <input
              className="rounded-xl border border-border px-3.5 py-2.5 text-sm"
              placeholder="Име и фамилия (по желание)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              className="rounded-xl border border-border px-3.5 py-2.5 text-sm"
              placeholder="Телефон *"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          {orderType === "pickup" ? (
            pickupAddress && (
              <p className="rounded-xl border border-border bg-black/5 px-3.5 py-2.5 text-sm">
                <span className="text-muted">Вземане от: </span>
                {pickupAddress}
              </p>
            )
          ) : usingSavedAddress ? (
            <div className="rounded-xl border border-border bg-black/5 px-3.5 py-2.5 text-sm space-y-1">
              <p>
                <span className="text-muted">Квартал: </span>
                {quarter}
              </p>
              <p>
                <span className="text-muted">Адрес: </span>
                {street} {houseNumber}
              </p>
              {addressNotes && (
                <p className="text-xs text-muted">Етаж/апартамент: {addressNotes}</p>
              )}
              {intercom && <p className="text-xs text-muted">Звънец: {intercom}</p>}
              <button
                type="button"
                onClick={() => pickSavedAddress("new")}
                className="text-xs font-semibold text-brand"
              >
                Промени / въведи друг адрес
              </button>
            </div>
          ) : (
            <>
              <input
                className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm"
                placeholder="Квартал *"
                value={quarter}
                onChange={(e) => {
                  addressTouchedRef.current = true;
                  setQuarter(e.target.value);
                }}
              />
              <div className="grid sm:grid-cols-[1fr_140px] gap-3">
                <input
                  className="rounded-xl border border-border px-3.5 py-2.5 text-sm"
                  placeholder="Улица *"
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                />
                <input
                  className="rounded-xl border border-border px-3.5 py-2.5 text-sm"
                  placeholder="Номер *"
                  value={houseNumber}
                  onChange={(e) => setHouseNumber(e.target.value)}
                />
              </div>
              <p className="text-xs text-muted -mt-2">
                Кварталът, улицата и номерът ориентират картата — моля, попълвайте ги точно.
              </p>
              <input
                className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm"
                placeholder="Етаж, блок, апартамент (по желание)"
                value={addressNotes}
                onChange={(e) => setAddressNotes(e.target.value)}
              />
              <input
                className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm"
                placeholder="Звънец — име/номер на табло (по желание)"
                value={intercom}
                onChange={(e) => setIntercom(e.target.value)}
              />
            </>
          )}
          <textarea
            className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm"
            placeholder="Бележки към поръчката (по желание)"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div className="bg-surface rounded-2xl border border-border p-5 space-y-3">
          <h2 className="font-semibold">Начин на плащане</h2>
          {(
            [
              {
                value: "cash",
                label: isPickup ? "В брой на място" : "Наложен платеж — в брой на куриера",
              },
              {
                value: "card_on_delivery",
                label: isPickup
                  ? "С карта на място (ПОС)"
                  : "Наложен платеж — с карта на куриера (ПОС)",
              },
              { value: "stripe", label: "Картово плащане онлайн сега" },
            ] as const
          ).map((opt) => (
            <label
              key={opt.value}
              className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 text-sm cursor-pointer ${
                paymentMethod === opt.value ? "border-brand bg-brand/5" : "border-border"
              }`}
            >
              <input
                type="radio"
                name="payment"
                checked={paymentMethod === opt.value}
                onChange={() => setPaymentMethod(opt.value)}
                className="accent-[var(--brand)]"
              />
              {opt.label}
            </label>
          ))}
        </div>

        <div className="bg-surface rounded-2xl border border-border p-5 space-y-3">
          <h2 className="font-semibold">Час на доставка</h2>
          {!shopOpenNow && (
            <p className="text-xs text-brand font-semibold">
              В момента сме затворени — изберете час, в който сме отворени.
            </p>
          )}
          <label
            className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 text-sm ${
              !shopOpenNow ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
            } ${deliveryTiming === "asap" ? "border-brand bg-brand/5" : "border-border"}`}
          >
            <input
              type="radio"
              name="delivery-timing"
              checked={deliveryTiming === "asap"}
              onChange={() => setDeliveryTiming("asap")}
              className="accent-[var(--brand)]"
              disabled={!shopOpenNow}
            />
            Възможно най-скоро (стандартно)
          </label>
          <label
            className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 text-sm cursor-pointer ${
              deliveryTiming === "scheduled" ? "border-brand bg-brand/5" : "border-border"
            }`}
          >
            <input
              type="radio"
              name="delivery-timing"
              checked={deliveryTiming === "scheduled"}
              onChange={() => setDeliveryTiming("scheduled")}
              className="accent-[var(--brand)]"
              disabled={availableSlots.length === 0}
            />
            Избери час
          </label>
          {deliveryTiming === "scheduled" && (
            <select
              className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm"
              value={selectedSlotKey}
              onChange={(e) => setSelectedSlotKey(e.target.value)}
            >
              {availableSlots.map((s) => (
                <option key={slotKey(s)} value={slotKey(s)}>
                  {s.label}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <aside className="bg-surface rounded-2xl border border-border p-5 h-fit space-y-4">
        <h2 className="font-semibold">Резюме на поръчката</h2>
        <ul className="space-y-2 text-sm max-h-64 overflow-y-auto">
          {lines.map((l) => (
            <li key={keyOf(l)} className="flex justify-between gap-2">
              <span className="text-muted">
                {l.quantity}× {l.name}
                {l.sizeLabel ? ` (${l.sizeLabel})` : ""}
                {l.removedIngredients && l.removedIngredients.length > 0 && (
                  <span className="block text-brand text-xs">
                    Без: {l.removedIngredients.join(", ")}
                  </span>
                )}
              </span>
              <span className="font-semibold shrink-0">
                {formatPrice(
                  (l.unitPrice + l.extras.reduce((s, e) => s + e.price, 0)) * l.quantity
                )}
              </span>
            </li>
          ))}
        </ul>

        <div className="flex gap-2">
          <input
            className="flex-1 rounded-xl border border-border px-3 py-2 text-sm"
            placeholder="Промо код"
            value={promoInput}
            onChange={(e) => setPromoInput(e.target.value)}
          />
          <button
            onClick={applyPromo}
            className="rounded-xl bg-accent-dark text-white px-4 text-sm font-semibold"
          >
            Приложи
          </button>
        </div>
        {promoError && <p className="text-xs text-brand">{promoError}</p>}
        {promoApplied && (
          <p className="text-xs text-success font-semibold">
            Приложен код {promoApplied.code}: -{formatPrice(promoApplied.discount)}
          </p>
        )}

        <div className="border-t border-border pt-3 space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-muted">Междинна сума</span>
            <span>{formatPrice(subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">{isPickup ? "Вземане от място" : "Доставка"}</span>
            <span>{deliveryFee === 0 ? (isPickup ? "—" : "Безплатна") : formatPrice(deliveryFee)}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-success">
              <span>Отстъпка</span>
              <span>-{formatPrice(discount)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-base pt-1">
            <span>Общо</span>
            <span>{formatPrice(total)}</span>
          </div>
        </div>

        {!meetsMinimum && (
          <p className="text-xs text-brand">
            Минималната поръчка е {formatPrice(minOrderGlobal)}.
          </p>
        )}
        {submitError && <p className="text-xs text-brand font-semibold">{submitError}</p>}

        <button
          onClick={submitOrder}
          disabled={submitting}
          className="w-full bg-brand text-white rounded-xl py-3.5 font-bold hover:bg-brand-dark transition-colors disabled:opacity-60"
        >
          {submitting ? "Изпращане..." : "Потвърди поръчката"}
        </button>
      </aside>
    </div>
  );
}
