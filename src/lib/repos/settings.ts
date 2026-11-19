import { getDb } from "@/lib/db";
import { DEFAULT_BUSY_HOURS } from "@/lib/delivery-estimate";

export const DEFAULT_SETTINGS = {
  site_name: "DannyFoods",
  tagline: "Гладен? Доставяме бързо.",
  phone: "052 000 000",
  address: "гр. Варна",
  working_hours: "Всеки ден: 09:00 - 00:00",
  opening_time: "09:00",
  closing_time: "00:00",
  min_order_global: "10",
  free_delivery_over: "25",
  delivery_fee_flat: "2.50",
  primary_color: "#e11d2e",
  accent_color: "#1a1a1a",
  facebook_url: "",
  instagram_url: "",
  banner_text: "🚚 Безплатна доставка при поръчка над 25 € · 🔥 Пресни продукти всеки ден",
  banner_scroll_mode: "scroll",
  stripe_publishable_key: "",
  stripe_secret_key: "",
  logo_url: "",
  google_client_id: "",
  google_client_secret: "",
  busy_hours_json: JSON.stringify(DEFAULT_BUSY_HOURS),

  contact_email: "",
  site_domain: "",
  company_legal_name: "",
  company_eik: "",
  company_vat: "",
  company_registered_address: "",

  ga_measurement_id: "",
  meta_pixel_id: "",

  suggested_category_id: "",

  admin_email: "",

  pizza_stripe_account_id: "",

  resend_api_key: "",
  notification_from_email: "DannyFoods <поръчки@foodsdany.bg>",

  deepl_api_key: "",
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
