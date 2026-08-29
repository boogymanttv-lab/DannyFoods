"use client";

import { useState } from "react";
import { ImageUploadField } from "@/components/admin/ImageUploadField";
import type { PromoCard } from "@/lib/types";

// The 4 slots always exist as rows (seeded once in a migration) — editing
// here is always an UPDATE against an existing position, never a
// create/delete, so the homepage layout never has to handle "3 cards" or
// "5 cards", only "some subset of these 4 are active".
export function PromoCardsManager({ initialCards }: { initialCards: PromoCard[] }) {
  const [cards, setCards] = useState(initialCards);
  const [savingPosition, setSavingPosition] = useState<number | null>(null);
  const [savedPosition, setSavedPosition] = useState<number | null>(null);

  function updateLocal(position: number, patch: Partial<PromoCard>) {
    setCards((prev) => prev.map((c) => (c.position === position ? { ...c, ...patch } : c)));
  }

  async function save(card: PromoCard) {
    setSavingPosition(card.position);
    setSavedPosition(null);
    await fetch(`/api/admin/promo-cards/${card.position}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        active: Boolean(card.active),
        title: card.title,
        subtitle: card.subtitle,
        description: card.description,
        image: card.image,
      }),
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
          &quot;Разгледай менюто&quot;. Натискане на активна карта отвежда клиента към{" "}
          <span className="font-semibold">/oferti</span> — там се показва и описанието.
          Неактивна карта просто не се показва — слотовете не се преномерират.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {cards.map((card) => (
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

            <input
              className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm"
              placeholder="Заглавие (напр. „Пица + Дюнер“)"
              value={card.title}
              onChange={(e) => updateLocal(card.position, { title: e.target.value })}
            />
            <input
              className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm"
              placeholder="Кратък текст върху картата (напр. „от 15.90 €“)"
              value={card.subtitle}
              onChange={(e) => updateLocal(card.position, { subtitle: e.target.value })}
            />
            <textarea
              className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm"
              placeholder="По-дълго описание — показва се само на страницата /oferti"
              rows={2}
              value={card.description}
              onChange={(e) => updateLocal(card.position, { description: e.target.value })}
            />
            <ImageUploadField
              value={card.image}
              onChange={(url) => updateLocal(card.position, { image: url })}
            />

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
        ))}
      </div>
    </div>
  );
}
