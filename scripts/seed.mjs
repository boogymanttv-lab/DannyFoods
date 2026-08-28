// Seed script for DaniDunner — run with: npm run seed
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const DB_PATH = path.join(ROOT, "data", "danidunner.db");

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");
db.exec(fs.readFileSync(path.join(ROOT, "src", "lib", "schema.sql"), "utf-8"));

// Same migration this app runs in src/lib/db.ts — needed here too because
// this script talks to node:sqlite directly, on a database file that may
// have been created before the courier feature existed (which added the
// orders.courier_id / claimed_at / delivered_at columns).
{
  const orderColumns = db
    .prepare("PRAGMA table_info(orders)")
    .all()
    .map((c) => c.name);
  if (!orderColumns.includes("courier_id")) {
    db.exec(
      "ALTER TABLE orders ADD COLUMN courier_id INTEGER REFERENCES couriers(id) ON DELETE SET NULL"
    );
  }
  if (!orderColumns.includes("claimed_at")) {
    db.exec("ALTER TABLE orders ADD COLUMN claimed_at TEXT");
  }
  if (!orderColumns.includes("delivered_at")) {
    db.exec("ALTER TABLE orders ADD COLUMN delivered_at TEXT");
  }
  if (!orderColumns.includes("dest_lat")) {
    db.exec("ALTER TABLE orders ADD COLUMN dest_lat REAL");
  }
  if (!orderColumns.includes("dest_lng")) {
    db.exec("ALTER TABLE orders ADD COLUMN dest_lng REAL");
  }
  if (!orderColumns.includes("customer_id")) {
    db.exec(
      "ALTER TABLE orders ADD COLUMN customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL"
    );
  }
  if (!orderColumns.includes("estimated_delivery")) {
    db.exec("ALTER TABLE orders ADD COLUMN estimated_delivery TEXT");
  }
  if (!orderColumns.includes("estimated_delivery_set_at")) {
    db.exec("ALTER TABLE orders ADD COLUMN estimated_delivery_set_at TEXT");
  }
  if (!orderColumns.includes("requested_time")) {
    db.exec("ALTER TABLE orders ADD COLUMN requested_time TEXT");
  }
  db.exec("CREATE INDEX IF NOT EXISTS idx_orders_courier ON orders(courier_id)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id)");
}

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || "admin@danidunner.bg";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || "DaniDunner2026!";

function reset() {
  const tables = [
    "orders",
    "couriers",
    "product_sizes",
    "extras",
    "products",
    "categories",
    "delivery_zones",
    "promotions",
    "site_settings",
  ];
  for (const t of tables) db.exec(`DELETE FROM ${t}`);
  // Reset auto-increment counters so IDs start from 1 again on a fresh seed.
  db.exec(
    `DELETE FROM sqlite_sequence WHERE name IN (${tables.map((t) => `'${t}'`).join(",")})`
  );
}

reset();

// ---------- Categories ----------
const categories = [
  { slug: "pizza", name: "Пици", icon: "🍕", sort_order: 1 },
  { slug: "durum", name: "Дюнери", icon: "🌯", sort_order: 2 },
  { slug: "burgers", name: "Бургери", icon: "🍔", sort_order: 3 },
  { slug: "sandwiches", name: "Сандвичи", icon: "🥪", sort_order: 4 },
  { slug: "pockets", name: "Джобове", icon: "🥙", sort_order: 5 },
];

const insertCategory = db.prepare(
  "INSERT INTO categories (slug, name, icon, sort_order) VALUES (@slug, @name, @icon, @sort_order)"
);
const categoryIds = {};
for (const c of categories) {
  const info = insertCategory.run(c);
  categoryIds[c.slug] = info.lastInsertRowid;
}

// ---------- Extras (shared addons) ----------
const insertExtra = db.prepare(
  "INSERT INTO extras (name, price, category_id) VALUES (@name, @price, @category_id)"
);
const commonExtras = [
  { name: "Извара сирене", price: 1.5, category_id: null },
  { name: "Кашкавал", price: 1.5, category_id: null },
  { name: "Бекон", price: 2, category_id: null },
  { name: "Халапеньо", price: 1, category_id: null },
  { name: "Двойно месо", price: 3, category_id: categoryIds.durum },
  { name: "Двойно месо", price: 3.5, category_id: categoryIds.burgers },
  { name: "Пържени картофи (порция)", price: 2.5, category_id: null },
  { name: "Чеснов сос", price: 0.8, category_id: null },
  { name: "Люти чушки", price: 0.5, category_id: null },
];
for (const e of commonExtras) insertExtra.run(e);

// ---------- Products ----------
const insertProduct = db.prepare(
  `INSERT INTO products (category_id, name, description, image, base_price, is_pizza, featured, sort_order)
   VALUES (@category_id, @name, @description, @image, @base_price, @is_pizza, @featured, @sort_order)`
);
const insertSize = db.prepare(
  `INSERT INTO product_sizes (product_id, label, price_delta, is_default, sort_order)
   VALUES (@product_id, @label, @price_delta, @is_default, @sort_order)`
);

function addProduct(catSlug, p) {
  const info = insertProduct.run({
    category_id: categoryIds[catSlug],
    name: p.name,
    description: p.description || "",
    image: p.image || "",
    base_price: p.base_price,
    is_pizza: p.is_pizza ? 1 : 0,
    featured: p.featured ? 1 : 0,
    sort_order: p.sort_order ?? 0,
  });
  const productId = info.lastInsertRowid;
  const sizes = p.sizes || [{ label: "Стандартна", price_delta: 0, is_default: true }];
  sizes.forEach((s, idx) => {
    insertSize.run({
      product_id: productId,
      label: s.label,
      price_delta: s.price_delta,
      is_default: s.is_default ? 1 : 0,
      sort_order: idx,
    });
  });
  return productId;
}

// Pizzas — two sizes: 32см / 40см
const pizzaSizes = (base) => [
  { label: "32см", price_delta: 0, is_default: true },
  { label: "40см", price_delta: Math.round(base * 0.55 * 100) / 100 },
];

addProduct("pizza", {
  name: "Маргарита",
  description: "Доматен сос, моцарела, босилек",
  base_price: 12.9,
  is_pizza: true,
  featured: true,
  sort_order: 1,
  sizes: pizzaSizes(12.9),
});
addProduct("pizza", {
  name: "Четири сезона",
  description: "Шунка, гъби, маслини, артишок, моцарела",
  base_price: 15.9,
  is_pizza: true,
  sort_order: 2,
  sizes: pizzaSizes(15.9),
});
addProduct("pizza", {
  name: "Пеперони",
  description: "Пикантен пеперони салам, моцарела, доматен сос",
  base_price: 15.5,
  is_pizza: true,
  featured: true,
  sort_order: 3,
  sizes: pizzaSizes(15.5),
});
addProduct("pizza", {
  name: "Прошуто е Фунги",
  description: "Шунка прошуто, шампиньони, моцарела",
  base_price: 16.9,
  is_pizza: true,
  sort_order: 4,
  sizes: pizzaSizes(16.9),
});
addProduct("pizza", {
  name: "Четири сирена",
  description: "Моцарела, горгонзола, пармезан, кашкавал",
  base_price: 16.5,
  is_pizza: true,
  sort_order: 5,
  sizes: pizzaSizes(16.5),
});
addProduct("pizza", {
  name: "Барбекю Чикън",
  description: "Пилешко филе, царевица, лук, барбекю сос, моцарела",
  base_price: 17.5,
  is_pizza: true,
  featured: true,
  sort_order: 6,
  sizes: pizzaSizes(17.5),
});
addProduct("pizza", {
  name: "Капричоза",
  description: "Шунка, гъби, маслини, моцарела, доматен сос",
  base_price: 15.9,
  is_pizza: true,
  sort_order: 7,
  sizes: pizzaSizes(15.9),
});
addProduct("pizza", {
  name: "Диаволо",
  description: "Пикантен салам, люти чушки, халапеньо, моцарела",
  base_price: 16.9,
  is_pizza: true,
  sort_order: 8,
  sizes: pizzaSizes(16.9),
});

// Döner / Дюнери
addProduct("durum", {
  name: "Дюнер Класик - Пилешко",
  description: "Пилешко месо, зеле, домат, лук, дюнер сос, лаваш",
  base_price: 8.5,
  featured: true,
  sort_order: 1,
  sizes: [
    { label: "Малък", price_delta: 0, is_default: true },
    { label: "Голям (XXL)", price_delta: 3 },
  ],
});
addProduct("durum", {
  name: "Дюнер Класик - Телешко",
  description: "Телешко месо, зеле, домат, лук, дюнер сос, лаваш",
  base_price: 9.5,
  sort_order: 2,
  sizes: [
    { label: "Малък", price_delta: 0, is_default: true },
    { label: "Голям (XXL)", price_delta: 3 },
  ],
});
addProduct("durum", {
  name: "Дюнер Микс (пилешко + телешко)",
  description: "Комбинирано месо, зеле, домат, лук, чесново-йогуртов сос",
  base_price: 10.5,
  featured: true,
  sort_order: 3,
  sizes: [
    { label: "Малък", price_delta: 0, is_default: true },
    { label: "Голям (XXL)", price_delta: 3.5 },
  ],
});
addProduct("durum", {
  name: "Дюнер Чиз",
  description: "Пилешко месо, разтопено сирене чедър, зеленчуци, сос",
  base_price: 9.9,
  sort_order: 4,
});
addProduct("durum", {
  name: "Вегетариански Дюнер",
  description: "Печени зеленчуци, фалафел, зеле, доматен сос",
  base_price: 8.9,
  sort_order: 5,
});

// Burgers / Бургери
addProduct("burgers", {
  name: "Чийзбургер",
  description: "150г телешко кюфте, чедър, маруля, домат, кисели краставички",
  base_price: 9.9,
  featured: true,
  sort_order: 1,
});
addProduct("burgers", {
  name: "Дабъл Бекон Бургер",
  description: "2x150г кюфте, бекон, чедър, карамелизиран лук, BBQ сос",
  base_price: 14.9,
  featured: true,
  sort_order: 2,
});
addProduct("burgers", {
  name: "Пилешки Крънчи Бургер",
  description: "Панирано пилешко филе, маруля, майонеза, кисели краставички",
  base_price: 10.5,
  sort_order: 3,
});
addProduct("burgers", {
  name: "Вегетариански Бургер",
  description: "Кюфте от нахут и зеленчуци, авокадо, маруля, домат",
  base_price: 10.9,
  sort_order: 4,
});
addProduct("burgers", {
  name: "Класик Хамбургер",
  description: "150г телешко кюфте, маруля, домат, лук, кетчуп, горчица",
  base_price: 8.9,
  sort_order: 5,
});

// Sandwiches / Сандвичи
addProduct("sandwiches", {
  name: "Клуб Сандвич",
  description: "Пилешко филе, бекон, яйце, маруля, домат, майонеза, тост хляб",
  base_price: 8.9,
  featured: true,
  sort_order: 1,
});
addProduct("sandwiches", {
  name: "Сандвич с Шунка и Сирене",
  description: "Шунка, кашкавал, масло, багета",
  base_price: 6.9,
  sort_order: 2,
});
addProduct("sandwiches", {
  name: "Тон Сандвич",
  description: "Риба тон, царевица, майонеза, маруля, багета",
  base_price: 7.9,
  sort_order: 3,
});
addProduct("sandwiches", {
  name: "Кайма Сандвич",
  description: "Пикантна кайма, сирене, люти чушки, багета",
  base_price: 7.5,
  sort_order: 4,
});

// Pockets / Джобове
addProduct("pockets", {
  name: "Джоб с Кайма и Сирене",
  description: "Пикантна кайма, извара сирене, домати, в пухкаво тесто",
  base_price: 6.5,
  featured: true,
  sort_order: 1,
});
addProduct("pockets", {
  name: "Джоб с Пиле и Гъби",
  description: "Пилешко филе, гъби, кашкавал, сметанов сос",
  base_price: 6.9,
  sort_order: 2,
});
addProduct("pockets", {
  name: "Джоб със Сирене и Спанак",
  description: "Извара сирене, пресен спанак, яйце",
  base_price: 5.9,
  sort_order: 3,
});
addProduct("pockets", {
  name: "Джоб Пеперони",
  description: "Пеперони салам, моцарела, доматен сос",
  base_price: 6.9,
  sort_order: 4,
});

// ---------- Delivery zones (Varna neighborhoods) ----------
const insertZone = db.prepare(
  `INSERT INTO delivery_zones (name, delivery_fee, min_order, sort_order) VALUES (@name, @delivery_fee, @min_order, @sort_order)`
);
const zones = [
  { name: "Център", delivery_fee: 2.5, min_order: 15 },
  { name: "Морска градина / Кв. Чайка", delivery_fee: 3, min_order: 15 },
  { name: "Владислав Варненчик", delivery_fee: 4, min_order: 20 },
  { name: "Младост", delivery_fee: 4, min_order: 20 },
  { name: "Възраждане", delivery_fee: 3.5, min_order: 18 },
  { name: "Аспарухово", delivery_fee: 4.5, min_order: 20 },
  { name: "Виница", delivery_fee: 4.5, min_order: 20 },
  { name: "Галата", delivery_fee: 5, min_order: 25 },
  { name: "Левски", delivery_fee: 3.5, min_order: 18 },
  { name: "Западна промишлена зона", delivery_fee: 5, min_order: 25 },
];
zones.forEach((z, idx) => insertZone.run({ ...z, sort_order: idx }));

// ---------- Promotions ----------
const insertPromo = db.prepare(
  `INSERT INTO promotions (code, description, discount_type, discount_value, min_order, usage_limit)
   VALUES (@code, @description, @discount_type, @discount_value, @min_order, @usage_limit)`
);
insertPromo.run({
  code: "DOBREDOSHAL10",
  description: "10% отстъпка за нови клиенти",
  discount_type: "percent",
  discount_value: 10,
  min_order: 15,
  usage_limit: null,
});
insertPromo.run({
  code: "VARNA5",
  description: "5 лв. отстъпка над 40 лв. поръчка",
  discount_type: "fixed",
  discount_value: 5,
  min_order: 40,
  usage_limit: null,
});

// ---------- Site settings ----------
const insertSetting = db.prepare(
  `INSERT INTO site_settings (key, value) VALUES (@key, @value)
   ON CONFLICT(key) DO UPDATE SET value = excluded.value`
);
const settings = {
  site_name: "DaniDunner",
  tagline: "Пица, Дюнери, Бургери, Сандвичи и Джобове с бърза доставка във Варна",
  phone: "052 000 000",
  address: "гр. Варна",
  working_hours: "Всеки ден: 09:00 - 00:00",
  opening_time: "09:00",
  closing_time: "00:00",
  min_order_global: "15",
  free_delivery_over: "50",
  primary_color: "#e11d2e",
  accent_color: "#1a1a1a",
  banner_text: "Безплатна доставка над 50 лв. в цяла Варна!",
};
for (const [key, value] of Object.entries(settings)) insertSetting.run({ key, value });

// ---------- Admin user ----------
db.prepare("DELETE FROM admin_users WHERE email = ?").run(ADMIN_EMAIL);
const passwordHash = bcrypt.hashSync(ADMIN_PASSWORD, 10);
db.prepare(
  "INSERT INTO admin_users (email, password_hash, name) VALUES (?, ?, ?)"
).run(ADMIN_EMAIL, passwordHash, "Admin");

// ---------- Demo couriers ----------
const COURIER_PASSWORD = process.env.SEED_COURIER_PASSWORD || "Kurier2026!";
const courierPasswordHash = bcrypt.hashSync(COURIER_PASSWORD, 10);
const insertCourier = db.prepare(
  "INSERT INTO couriers (name, phone, password_hash) VALUES (@name, @phone, @password_hash)"
);
const demoCouriers = [
  { name: "Георги Петров", phone: "0888111111" },
  { name: "Мартин Иванов", phone: "0888222222" },
];
for (const c of demoCouriers) insertCourier.run({ ...c, password_hash: courierPasswordHash });

console.log("✅ Seed завършен успешно.");
console.log(`   Админ вход:  ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
console.log(`   Демо куриери (вход на /courier/login), парола за всички: ${COURIER_PASSWORD}`);
for (const c of demoCouriers) console.log(`     - ${c.name}: ${c.phone}`);
console.log(`   Продукти: ${db.prepare("SELECT COUNT(*) c FROM products").get().c}`);
console.log(`   Зони: ${db.prepare("SELECT COUNT(*) c FROM delivery_zones").get().c}`);
