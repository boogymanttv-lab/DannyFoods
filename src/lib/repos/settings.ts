import { getDb } from "@/lib/db";
import { DEFAULT_BUSY_HOURS } from "@/lib/delivery-estimate";

export const DEFAULT_SETTINGS = {
  site_name: "DannyFoods",
  tagline: "Пица, Дюнери, Бургери, Сандвичи и Джобове с бърза доставка във Варна",
  phone: "052 000 000",
  // Public-facing address shown on the Contact page, the footer, and (as
  // the legal texts note) where an order can be picked up in person.
  address: "гр. Варна",
  working_hours: "Всеки ден: 09:00 - 00:00",
  opening_time: "09:00",
  closing_time: "00:00",
  min_order_global: "8",
  free_delivery_over: "25",
  primary_color: "#e11d2e",
  accent_color: "#1a1a1a",
  facebook_url: "",
  instagram_url: "",
  banner_text: "Безплатна доставка над 25 € в цяла Варна!",
  stripe_publishable_key: "",
  stripe_secret_key: "",
  logo_url: "",
  google_client_id: "",
  google_client_secret: "",
  busy_hours_json: JSON.stringify(DEFAULT_BUSY_HOURS),

  // --- Company / legal identity (used on the Privacy Policy, Terms of Use,
  // and site footer — required disclosures under Bulgarian e-commerce law
  // (ЗЕТ) and GDPR/ЗЗЛД for a publicly-operating online trader). ---
  contact_email: "",
  site_domain: "",
  company_legal_name: "",
  company_eik: "",
  company_vat: "",
  // The registered seat/office on file with the Commercial Register — can
  // differ from the public "address" above (e.g. a home address used only
  // for registration vs. an actual kitchen/pickup location).
  company_registered_address: "",

  // --- Analytics / advertising (optional — left blank = not used). Loaded
  // client-side only after the visitor accepts non-essential cookies via
  // the cookie-consent banner, per GDPR/ePrivacy. ---
  ga_measurement_id: "",
  meta_pixel_id: "",

  // --- Upsell: which category's products show as "Често купувано с"
  // suggestions inside every product's detail modal (e.g. pick the
  // "Напитки" category so drinks are suggested under every product).
  // Empty string = feature off. Stored as the category id (as a string,
  // matching this key/value settings table). ---
  suggested_category_id: "",

  // --- Access: which email automatically gets admin access after a normal
  // customer login/registration (password or Google) — no separate admin
  // credentials needed day-to-day. Empty = feature off (the dedicated
  // /admin/login form with its own admin_users table still works as a
  // fallback either way). Compared case-insensitively. ---
  admin_email: "",
};

export type SettingsKey = keyof typeof DEFAULT_SETTINGS;

export async function getSettings(): Promise<typeof DEFAULT_SETTINGS> {
  const db = await getDb();
  const rows = (await db.prepare("SELECT key, value FROM site_settings").all()) as {
    key: string;
    value: string;
  }[];
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return { ...DEFAULT_SETTINGS, ...map };
}

export async function updateSettings(data: Partial<Record<SettingsKey, string>>) {
  const db = await getDb();
  const tx = db.transaction(async () => {
    const stmt = db.prepare(
      `INSERT INTO site_settings (key, value) VALUES (@key, @value)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    );
    for (const [key, value] of Object.entries(data)) {
      await stmt.run({ key, value: value ?? "" });
    }
  });
  await tx();
}
