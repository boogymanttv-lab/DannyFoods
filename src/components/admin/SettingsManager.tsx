"use client";

import { useEffect, useState } from "react";
import type { DEFAULT_SETTINGS } from "@/lib/repos/settings";
import { ImageUploadField } from "@/components/admin/ImageUploadField";
import type { Category } from "@/lib/types";
import {
  DAY_LABELS,
  parseBusyHours,
  type BusyHourRule,
} from "@/lib/delivery-estimate";

type Settings = typeof DEFAULT_SETTINGS;

function randomId() {
  return Math.random().toString(36).slice(2, 9);
}

export function SettingsManager({
  initialSettings,
  categories,
}: {
  initialSettings: Settings;
  categories: Category[];
}) {
  const [settings, setSettings] = useState(initialSettings);
  const [saved, setSaved] = useState(false);
  const [origin, setOrigin] = useState("");
  const [busyRules, setBusyRules] = useState<BusyHourRule[]>(() =>
    parseBusyHours(initialSettings.busy_hours_json)
  );

  function updateRule(id: string, patch: Partial<BusyHourRule>) {
    setBusyRules((rules) => rules.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    setSaved(false);
  }

  function toggleDay(id: string, day: number) {
    setBusyRules((rules) =>
      rules.map((r) =>
        r.id === id
          ? {
              ...r,
              days: r.days.includes(day)
                ? r.days.filter((d) => d !== day)
                : [...r.days, day].sort(),
            }
          : r
      )
    );
    setSaved(false);
  }

  function addRule() {
    setBusyRules((rules) => [
      ...rules,
      { id: randomId(), label: "Ново натоварване", days: [1, 2, 3, 4, 5], start: "16:00", end: "18:00" },
    ]);
    setSaved(false);
  }

  function removeRule(id: string) {
    setBusyRules((rules) => rules.filter((r) => r.id !== id));
    setSaved(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading window.location is only possible client-side, one-time on mount
    setOrigin(window.location.origin);
  }, []);

  function set<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((s) => ({ ...s, [key]: value }));
    setSaved(false);
  }

  async function save() {
    await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...settings, busy_hours_json: JSON.stringify(busyRules) }),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="font-display font-extrabold text-2xl">Настройки на сайта</h1>

      <Section title="Обща информация">
        <Field label="Име на сайта">
          <input
            className="input"
            value={settings.site_name}
            onChange={(e) => set("site_name", e.target.value)}
          />
        </Field>
        <Field label="Слоган / кратко описание">
          <input
            className="input"
            value={settings.tagline}
            onChange={(e) => set("tagline", e.target.value)}
          />
        </Field>
        <Field label="Промо лента (движещ се текст най-отгоре на сайта)">
          <input
            className="input"
            placeholder="Безплатна доставка при поръчка над 25 лв. · Доставка до 28 мин."
            value={settings.banner_text}
            onChange={(e) => set("banner_text", e.target.value)}
          />
        </Field>
        <p className="text-xs text-muted -mt-2">Оставете празно, за да скриете лентата.</p>
        <Field label="Телефон">
          <input
            className="input"
            value={settings.phone}
            onChange={(e) => set("phone", e.target.value)}
          />
        </Field>
        <Field label="Адрес (за контакт и вземане лично на поръчка)">
          <input
            className="input"
            value={settings.address}
            onChange={(e) => set("address", e.target.value)}
          />
        </Field>
        <Field label="Имейл за контакт (показва се публично)">
          <input
            type="email"
            className="input"
            placeholder="info@example.bg"
            value={settings.contact_email}
            onChange={(e) => set("contact_email", e.target.value)}
          />
        </Field>
        <Field label="Работно време (текст, показва се на сайта)">
          <input
            className="input"
            value={settings.working_hours}
            onChange={(e) => set("working_hours", e.target.value)}
          />
        </Field>
        <p className="text-xs text-muted -mt-2">
          Часовете отдолу определят кои часове клиентите могат да избират за доставка на страницата
          за плащане — трябва да съвпадат с текста за работно време по-горе.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Отваряме в">
            <input
              type="time"
              className="input"
              value={settings.opening_time}
              onChange={(e) => set("opening_time", e.target.value)}
            />
          </Field>
          <Field label="Затваряме в">
            <input
              type="time"
              className="input"
              value={settings.closing_time}
              onChange={(e) => set("closing_time", e.target.value)}
            />
          </Field>
        </div>
        <Field label="Лого (по желание)">
          <ImageUploadField value={settings.logo_url} onChange={(url) => set("logo_url", url)} />
        </Field>
      </Section>

      <Section title="Достъп до админ панела">
        <p className="text-xs text-muted -mt-2">
          Въведете имейл тук и той автоматично ще получи достъп до Админ панела веднага след
          обикновен вход/регистрация в сайта (с парола или с Google) — не е нужен отделен
          администраторски профил. Старата форма на /admin/login продължава да работи като резервен
          вариант.
        </p>
        <Field label="Имейл на администратора">
          <input
            type="email"
            className="input"
            placeholder="you@example.bg"
            value={settings.admin_email}
            onChange={(e) => set("admin_email", e.target.value)}
          />
        </Field>
      </Section>

      <Section title="Фирма и правни данни">
        <p className="text-xs text-muted -mt-2">
          Показват се в Условията за ползване, Политиката за защита на личните данни и футъра —
          задължителна публична информация за онлайн търговец по българското законодателство.
        </p>
        <Field label="Юридическо наименование на фирмата">
          <input
            className="input"
            placeholder="Име ООД/ЕООД"
            value={settings.company_legal_name}
            onChange={(e) => set("company_legal_name", e.target.value)}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="ЕИК/Булстат">
            <input
              className="input"
              value={settings.company_eik}
              onChange={(e) => set("company_eik", e.target.value)}
            />
          </Field>
          <Field label="ДДС номер (ако е регистрирана)">
            <input
              className="input"
              placeholder="BG..."
              value={settings.company_vat}
              onChange={(e) => set("company_vat", e.target.value)}
            />
          </Field>
        </div>
        <Field label="Седалище и адрес на управление (по търговски регистър)">
          <input
            className="input"
            value={settings.company_registered_address}
            onChange={(e) => set("company_registered_address", e.target.value)}
          />
        </Field>
        <Field label="Домейн на сайта (за SEO — sitemap, canonical връзки)">
          <input
            className="input"
            placeholder="example.bg"
            value={settings.site_domain}
            onChange={(e) => set("site_domain", e.target.value)}
          />
        </Field>
      </Section>

      <Section title="Тракинг и реклама (по желание)">
        <p className="text-xs text-muted -mt-2">
          Ако попълните някое от тези полета, съответният код се зарежда на сайта — но само след
          като посетителят даде съгласие в банера за бисквитки (изисква се по GDPR/ePrivacy).
          Оставете празно, ако не използвате.
        </p>
        <Field label="Google Analytics — Measurement ID">
          <input
            className="input"
            placeholder="G-XXXXXXXXXX"
            value={settings.ga_measurement_id}
            onChange={(e) => set("ga_measurement_id", e.target.value)}
          />
        </Field>
        <Field label="Meta (Facebook) Pixel — ID">
          <input
            className="input"
            placeholder="123456789012345"
            value={settings.meta_pixel_id}
            onChange={(e) => set("meta_pixel_id", e.target.value)}
          />
        </Field>
      </Section>

      <Section title="Често купувано с">
        <p className="text-xs text-muted -mt-2">
          Изберете категория продукти (например &quot;Напитки&quot;), която да се показва като
          предложение &quot;Често купувано с&quot; под избора на количество във всеки продукт от
          менюто. Оставете &quot;Изключено&quot;, за да скриете секцията навсякъде.
        </p>
        <Field label="Категория за предложения">
          <select
            className="input"
            value={settings.suggested_category_id}
            onChange={(e) => set("suggested_category_id", e.target.value)}
          >
            <option value="">Изключено</option>
            {categories.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.icon} {c.name}
              </option>
            ))}
          </select>
        </Field>
      </Section>

      <Section title="Социални мрежи">
        <p className="text-xs text-muted -mt-2">
          По желание — иконите се показват във футъра само ако полето е попълнено.
        </p>
        <Field label="Facebook (пълен линк)">
          <input
            className="input"
            placeholder="https://facebook.com/..."
            value={settings.facebook_url}
            onChange={(e) => set("facebook_url", e.target.value)}
          />
        </Field>
        <Field label="Instagram (пълен линк)">
          <input
            className="input"
            placeholder="https://instagram.com/..."
            value={settings.instagram_url}
            onChange={(e) => set("instagram_url", e.target.value)}
          />
        </Field>
      </Section>

      <Section title="Вход с Google">
        <p className="text-xs text-muted -mt-2">
          По желание — ако попълните тези две полета, на страниците за вход/регистрация
          ще се появи бутон &quot;Вход с Google&quot;. Данните се вземат от Google Cloud
          Console (безплатно): създайте OAuth Client ID (тип &quot;Web application&quot;) и
          добавете като &quot;Authorized redirect URI&quot; точно:
          <br />
          <code className="text-[11px] bg-black/5 px-1.5 py-0.5 rounded mt-1 inline-block">
            {origin}/api/account/google/callback
          </code>
        </p>
        <Field label="Google Client ID">
          <input
            className="input"
            value={settings.google_client_id}
            onChange={(e) => set("google_client_id", e.target.value)}
          />
        </Field>
        <Field label="Google Client Secret">
          <input
            type="password"
            className="input"
            value={settings.google_client_secret}
            onChange={(e) => set("google_client_secret", e.target.value)}
          />
        </Field>
      </Section>

      <Section title="Часове с натоварване">
        <p className="text-xs text-muted -mt-2">
          През тези часове при потвърждаване на поръчка панелът автоматично ще предлага по-дългото
          време за доставка (20-30 мин) вместо стандартното (15-20 мин). Винаги може ръчно да
          изберете друго време за конкретна поръчка. Добавете, редактирайте или изтрийте часови
          диапазони — денят на седмицата се избира с бутоните.
        </p>
        <div className="space-y-3">
          {busyRules.map((rule) => (
            <div key={rule.id} className="rounded-xl border border-border p-3 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  className="input flex-1"
                  value={rule.label}
                  onChange={(e) => updateRule(rule.id, { label: e.target.value })}
                />
                <button
                  onClick={() => removeRule(rule.id)}
                  className="text-xs font-semibold text-brand px-2 py-1 shrink-0"
                >
                  Изтрий
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {DAY_LABELS.map((label, day) => (
                  <button
                    key={day}
                    onClick={() => toggleDay(rule.id, day)}
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                      rule.days.includes(day)
                        ? "bg-brand text-white border-brand"
                        : "border-border text-foreground/70"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 text-sm">
                <input
                  type="time"
                  className="input"
                  value={rule.start}
                  onChange={(e) => updateRule(rule.id, { start: e.target.value })}
                />
                <span className="text-muted">до</span>
                <input
                  type="time"
                  className="input"
                  value={rule.end}
                  onChange={(e) => updateRule(rule.id, { end: e.target.value })}
                />
              </div>
            </div>
          ))}
          <button
            onClick={addRule}
            className="text-sm font-semibold text-brand border border-brand/30 rounded-xl px-4 py-2"
          >
            + Добави времеви диапазон
          </button>
        </div>
      </Section>

      <Section title="Доставка и промоции">
        <Field label="Такса за доставка (€)">
          <input
            type="number"
            step="0.01"
            className="input"
            value={settings.delivery_fee_flat}
            onChange={(e) => set("delivery_fee_flat", e.target.value)}
          />
        </Field>
        <Field label="Безплатна доставка над (€)">
          <input
            type="number"
            className="input"
            value={settings.free_delivery_over}
            onChange={(e) => set("free_delivery_over", e.target.value)}
          />
        </Field>
        <Field label="Минимална поръчка (€)">
          <input
            type="number"
            className="input"
            value={settings.min_order_global}
            onChange={(e) => set("min_order_global", e.target.value)}
          />
        </Field>
      </Section>

      <Section title="Разплащане с карта онлайн (Stripe)">
        <p className="text-xs text-muted -mt-2">
          Въведете ключовете от вашия Stripe акаунт, за да разрешите картово плащане онлайн.
          Може по-късно да смените с ePay/Viva Wallet, ако предпочитате български доставчик.
        </p>
        <Field label="Publishable key">
          <input
            className="input"
            value={settings.stripe_publishable_key}
            onChange={(e) => set("stripe_publishable_key", e.target.value)}
          />
        </Field>
        <Field label="Secret key">
          <input
            type="password"
            className="input"
            value={settings.stripe_secret_key}
            onChange={(e) => set("stripe_secret_key", e.target.value)}
          />
        </Field>
      </Section>

      <Section title="Имейл потвърждение на поръчка (Resend)">
        <p className="text-xs text-muted -mt-2">
          Ако попълните API ключа, всеки клиент, който въведе имейл при поръчка (или е
          логнат с имейл в профила), получава автоматично писмо с потвърждение и номер на
          поръчката. Оставете празно, за да изключите — чекаутът работи по същия начин и
          без това. Адресът &quot;От&quot; трябва да е на домейн, верифициран във вашия
          Resend акаунт (Resend → Domains), иначе изпращането ще се провали.
        </p>
        <Field label="Resend API key">
          <input
            type="password"
            className="input"
            value={settings.resend_api_key}
            onChange={(e) => set("resend_api_key", e.target.value)}
          />
        </Field>
        <Field label='Адрес "От" (напр. DannyFoods <поръчки@домейн.bg>)'>
          <input
            className="input"
            value={settings.notification_from_email}
            onChange={(e) => set("notification_from_email", e.target.value)}
          />
        </Field>
      </Section>

      <Section title="Автоматично разпределяне на плащанията (пица → друга сметка)">
        <p className="text-xs text-muted -mt-2">
          Ако попълните това поле, при всяко картово плащане делът за продуктите от типа
          &quot;пица&quot; автоматично се превежда към посочената Stripe Connect сметка — останалата
          част от плащането (другите продукти + пълната такса доставка) остава в основната Ви
          Stripe сметка. Оставете празно, за да изключите функцията (всичко остава в основната
          сметка, както досега).
        </p>
        <Field label="Stripe Connect account ID (за пицарията)">
          <input
            className="input"
            placeholder="acct_xxxxxxxxxxxxxxxx"
            value={settings.pizza_stripe_account_id}
            onChange={(e) => set("pizza_stripe_account_id", e.target.value)}
          />
        </Field>
      </Section>

      <button
        onClick={save}
        className="bg-brand text-white rounded-xl px-6 py-3 font-bold"
      >
        Запази настройките
      </button>
      {saved && <p className="text-success font-semibold text-sm">Настройките са запазени ✔</p>}

      <style jsx global>{`
        .input {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid var(--border);
          padding: 0.6rem 0.9rem;
          font-size: 0.875rem;
        }
      `}</style>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface rounded-2xl border border-border p-5 space-y-3">
      <h2 className="font-semibold">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs text-muted">{label}</span>
      {children}
    </label>
  );
}
