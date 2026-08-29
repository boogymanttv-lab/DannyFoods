"use client";

import { useState } from "react";
import { ImageUploadField } from "@/components/admin/ImageUploadField";
import { promoCardStyle } from "@/lib/promo-card-style";
import { comboSum, type ComboItemRow } from "@/lib/combo-preview";
import { formatPrice } from "@/lib/format";
import type { PromoCard, ProductWithOptions } from "@/lib/types";

type ComboCardState = {
  useCombo: boolean;
  discountPercent: number | string;
  items: ComboItemRow[];
};

// The 4 slots always exist as rows (seeded once in a migration) — editing
// here is always an UPDATE against an existing position, never a
// create/delete, so the homepage layout never has to handle "3 cards" or
// "5 cards", only "some subset of these 4 are active".
export function PromoCardsManager({
  initialCards,
  initialProducts,
  initialCombos,
}: {
  initialCards: PromoCard[];
  initialProducts: ProductWithOptions[];
  initialCombos: Record<number, { discountPercent: number; items: ComboItemRow[] }>;
}) {
  const [cards, setCards] = useState(initialCards);
  const [products] = useState(initialProducts);
  const [savingPosition, setSavingPosition] = useState<number | null>(null);
  const [savedPosition, setSavedPosition] = useState<number | null>(null);

  const [comboState, setComboState] = useState<Record<number, ComboCardState>>(() => {
    const initial: Record<number, ComboCardState> = {};
    for (const card of initialCards) {
      initial[card.position] = {
        useCombo: Boolean(card.linked_product_id),
        discountPercent: initialCombos[card.position]?.discountPercent ?? 0,
        items: initialCombos[card.position]?.items ?? [],
      };
    }
    return initial;
  });

  function updateLocal(position: number, patch: Partial<PromoCard>) {
    setCards((prev) => prev.map((c) => (c.position === position ? { ...c, ...patch } : c)));
  }

  function setUseCombo(position: number, useCombo: boolean) {
    setComboState((prev) => ({ ...prev, [position]: { ...prev[position], useCombo } }));
  }

  function setDiscount(position: number, discountPercent: string) {
    setComboState((prev) => ({ ...prev, [position]: { ...prev[position], discountPercent } }));
  }

  function toggleComboItem(position: number, product: ProductWithOptions) {
    setComboState((prev) => {
      const state = prev[position];
      const exists = state.items.some((ci) => ci.product_id === product.id);
      const items = exists
        ? state.items.filter((ci) => ci.product_id !== product.id)
        : [
            ...state.items,
            {
              product_id: product.id,
              size_id: (product.sizes.find((s) => s.is_default) ?? product.sizes[0])?.id ?? null,
              quantity: 1,
            },
          ];
      return { ...prev, [position]: { ...state, items } };
    });
  }

  function updateComboItem(position: number, productId: number, patch: Partial<ComboItemRow>) {
    setComboState((prev) => {
      const state = prev[position];
      return {
        ...prev,
        [position]: {
          ...state,
          items: state.items.map((ci) =>
            ci.product_id === productId ? { ...ci, ...patch } : ci
          ),
        },
      };
    });
  }

  async function save(card: PromoCard) {
    const combo = comboState[card.position];
    setSavingPosition(card.position);
    setSavedPosition(null);
    const res = await fetch(`/api/admin/promo-cards/${card.position}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        active: Boolean(card.active),
        badge: card.badge,
        title: card.title,
        subtitle: card.subtitle,
        description: card.description,
        image: card.image,
        fullBanner: Boolean(card.full_banner),
        use_combo: combo.useCombo,
        combo_items: combo.items,
        combo_discount_percent: Number(combo.discountPercent) || 0,
      }),
    });
    const data = await res.json().catch(() => ({}));
    // The server may have created/updated the hidden linked product and
    // computed a fresh subtitle (the price text) — reflect that back into
    // this card's local state so the preview and next save stay in sync.
    updateLocal(card.position, {
      linked_product_id: data.linked_product_id ?? null,
      subtitle: data.subtitle ?? card.subtitle,
    });
    setSavingPosition(null);
    setSavedPosition(card.position);
    setTimeout(() => setSavedPosition((p) => (p === card.position ? null : p)), 2000);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display font-extrabold text-2xl">Витрина на началния екран</h1>
        <p className="text-muted text-sm mt-1">
          4-те карти, които се показват на началната страница, точно под бутона
          &quot;Разгледай менюто&quot; — на телефон като лента с малки карти, на
          компютър като 3 по-широки банера. Снимка е по избор — без такава
          картата пада на вграден цвят + иконка. Натискане на активна карта
          отвежда клиента към <span className="font-semibold">/oferti</span> — там
          се показва и по-дългото описание. Неактивна карта просто не се показва
          — слотовете не се преномерират. Можеш и да я направиш поръчваема
          директно (виж &quot;Комбо от продукти&quot; по-долу).
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {cards.map((card) => {
          const style = promoCardStyle(card.position);
          const combo = comboState[card.position];
          return (
            <div key={card.position} className="bg-surface rounded-2xl border border-border p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Карта {card.position}</h2>
                <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(card.active)}
                    onChange={(e) => updateLocal(card.position, { active: e.target.checked ? 1 : 0 })}
                    className="accent-[var(--brand)] h-4 w-4"
                  />
                  Активна
                </label>
              </div>

              {/* Live preview — square-photo/gradient-icon + badge treatment
                  as the phone card, or (when "Готов банер" is on) just the
                  raw image, untouched, on black. */}
              {card.full_banner ? (
                <div className="relative aspect-[3/2] w-52 rounded-xl overflow-hidden bg-black">
                  {card.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={card.image} alt="" className="absolute inset-0 h-full w-full object-contain" />
                  ) : (
                    <span className="absolute inset-0 grid place-items-center text-white/40 text-xs">
                      Качи снимка на банера
                    </span>
                  )}
                </div>
              ) : (
                <div
                  className={`relative aspect-square w-36 rounded-xl overflow-hidden bg-gradient-to-br ${style.gradient}`}
                >
                  {card.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={card.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
                  ) : (
                    <span aria-hidden className="absolute inset-0 grid place-items-center text-4xl">
                      {style.icon}
                    </span>
                  )}
                  {card.badge && (
                    <span className="absolute top-2 left-2 bg-brand text-white text-[9px] font-extrabold uppercase tracking-wide px-2 py-1 rounded-md">
                      {card.badge}
                    </span>
                  )}
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-2">
                    <p className="font-display font-bold text-white text-xs leading-tight">
                      {card.title || "Заглавие..."}
                    </p>
                    {card.subtitle && (
                      <p className="text-white font-bold text-xs mt-0.5">{card.subtitle}</p>
                    )}
                  </div>
                </div>
              )}

              <label className="flex items-start gap-2 text-xs text-muted bg-background rounded-xl border border-border px-3.5 py-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(card.full_banner)}
                  onChange={(e) =>
                    updateLocal(card.position, { full_banner: e.target.checked ? 1 : 0 })
                  }
                  className="accent-[var(--brand)] h-4 w-4 mt-0.5"
                />
                <span>
                  <span className="font-semibold text-foreground">Готов банер</span> — снимката
                  вече има целия текст (заглавие, цена и т.н.) вградени в нея. При включено, показваме
                  само снимката, изцяло и без нищо отгоре — заглавието/значката/цената по-долу се
                  ползват само вътрешно, не се виждат на сайта.
                </span>
              </label>

              <input
                className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm"
                placeholder="Значка (по желание, напр. „ХИТ ОФЕРТА“, „НОВО“)"
                value={card.badge}
                onChange={(e) => updateLocal(card.position, { badge: e.target.value })}
              />
              <input
                className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm"
                placeholder="Заглавие (напр. „Пица + Дюнер“)"
                value={card.title}
                onChange={(e) => updateLocal(card.position, { title: e.target.value })}
              />
              {!combo.useCombo && (
                <input
                  className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm"
                  placeholder="Кратък текст върху картата (напр. „от 15.90 €“)"
                  value={card.subtitle}
                  onChange={(e) => updateLocal(card.position, { subtitle: e.target.value })}
                />
              )}
              <textarea
                className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm"
                placeholder="Кратко описание"
                rows={2}
                value={card.description}
                onChange={(e) => updateLocal(card.position, { description: e.target.value })}
              />
              <ImageUploadField
                value={card.image}
                onChange={(url) => updateLocal(card.position, { image: url })}
              />

              <label className="flex items-start gap-2 text-xs text-muted bg-background rounded-xl border border-border px-3.5 py-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={combo.useCombo}
                  onChange={(e) => setUseCombo(card.position, e.target.checked)}
                  className="accent-[var(--brand)] h-4 w-4 mt-0.5"
                />
                <span>
                  <span className="font-semibold text-foreground">Комбо от продукти</span> —
                  вместо да пишеш цена на ръка, избираш кои съществуващи продукти влизат в тази
                  оферта; цената се смята сама от техните цени минус процент намаление, и картата
                  получава бутон, който добавя направо в количката на клиента — без да минава през
                  /oferti.
                </span>
              </label>

              {combo.useCombo && (
                <div className="rounded-xl border border-border p-3 space-y-3">
                  <p className="font-semibold text-sm">Продукти в офертата</p>
                  <div className="space-y-2 max-h-72 overflow-y-auto">
                    {products
                      .filter((p) => p.active === 1 && p.is_combo !== 1)
                      .map((p) => {
                        const item = combo.items.find((ci) => ci.product_id === p.id);
                        const included = Boolean(item);
                        return (
                          <div key={p.id} className="rounded-lg border border-border p-2">
                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                              <input
                                type="checkbox"
                                checked={included}
                                onChange={() => toggleComboItem(card.position, p)}
                                className="accent-[var(--brand)] h-4 w-4"
                              />
                              <span className="flex-1">{p.name}</span>
                              <span className="text-muted text-xs">{formatPrice(p.base_price)}</span>
                            </label>
                            {included && item && (
                              <div className="flex gap-2 items-center mt-2 pl-6">
                                <label className="text-xs text-muted">Бройки</label>
                                <input
                                  type="number"
                                  min={1}
                                  className="w-16 rounded-lg border border-border px-2 py-1.5 text-sm"
                                  value={item.quantity}
                                  onChange={(e) =>
                                    updateComboItem(card.position, p.id, {
                                      quantity: Math.max(1, Number(e.target.value) || 1),
                                    })
                                  }
                                />
                                {p.sizes.length > 1 && (
                                  <select
                                    className="flex-1 rounded-lg border border-border px-2 py-1.5 text-sm"
                                    value={item.size_id ?? ""}
                                    onChange={(e) =>
                                      updateComboItem(card.position, p.id, {
                                        size_id: Number(e.target.value),
                                      })
                                    }
                                  >
                                    {p.sizes.map((s) => (
                                      <option key={s.id} value={s.id}>
                                        {s.label} ({formatPrice(p.base_price + s.price_delta)})
                                      </option>
                                    ))}
                                  </select>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>

                  <div className="flex gap-2 items-center">
                    <label className="text-sm font-semibold whitespace-nowrap">% намаление</label>
                    <input
                      type="number"
                      step="1"
                      min={0}
                      max={100}
                      className="w-24 rounded-lg border border-border px-3 py-2 text-sm"
                      value={combo.discountPercent}
                      onChange={(e) => setDiscount(card.position, e.target.value)}
                    />
                  </div>

                  {(() => {
                    const sum = comboSum(combo.items, products);
                    const discount = Number(combo.discountPercent) || 0;
                    const final = sum * (1 - discount / 100);
                    return (
                      <div className="rounded-lg bg-background border border-border p-3 text-sm space-y-1">
                        <div className="flex justify-between text-muted">
                          <span>Сбор от избраните продукти</span>
                          <span>{formatPrice(sum)}</span>
                        </div>
                        <div className="flex justify-between font-bold text-base">
                          <span>Крайна цена (вижда я клиентът)</span>
                          <span className="text-brand">{formatPrice(final)}</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              <button
                onClick={() => save(card)}
                disabled={savingPosition === card.position}
                className="w-full bg-brand text-white rounded-xl py-2.5 font-bold text-sm disabled:opacity-60"
              >
                {savingPosition === card.position
                  ? "Запазване..."
                  : savedPosition === card.position
                    ? "Запазено ✓"
                    : "Запази"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
