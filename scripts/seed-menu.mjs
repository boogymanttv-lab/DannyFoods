// Adds the full demo menu (categories/products/extras/promotions/couriers)
// to an existing Postgres database — run with: DATABASE_URL=... node scripts/seed-menu.mjs
//
// This is the Postgres-era replacement for the old scripts/seed.mjs (which
// talked to a local node:sqlite file and reset the whole database on every
// run). This script is additive and idempotent instead: it's meant to be run
// once against a live Supabase database that the app's own migrations have
// already set up (schema + the "Напитки" category/products + delivery
// zones + site_settings), so it never touches those, never deletes
// anything, and skips anything that already exists (safe to re-run).
//
// Prices below are converted from the app's original leva-era demo prices
// to EUR at the historical BGN peg (1 EUR = 1.95583 BGN), then rounded to a
// sensible price ending — NOT a 1:1 digit copy of the old leva figures
// (which would be roughly double the real price in EUR).
import pg from "pg";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set. Example:\n  DATABASE_URL=postgres://... node scripts/seed-menu.mjs");
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: /sslmode=require|supabase\.co|pooler\.supabase\.com/.test(DATABASE_URL)
    ? { rejectUnauthorized: false }
    : undefined,
});

async function categoryId(slug, name, icon, sortOrder) {
  const existing = await pool.query("SELECT id FROM categories WHERE slug = $1", [slug]);
  if (existing.rows[0]) return existing.rows[0].id;
  const inserted = await pool.query(
    "INSERT INTO categories (slug, name, icon, sort_order) VALUES ($1,$2,$3,$4) RETURNING id",
    [slug, name, icon, sortOrder]
  );
  console.log(`  + категория "${name}"`);
  return inserted.rows[0].id;
}

async function addExtraIfMissing(name, price, categoryId) {
  const existing = await pool.query(
    "SELECT id FROM extras WHERE name = $1 AND (category_id IS NOT DISTINCT FROM $2)",
    [name, categoryId]
  );
  if (existing.rows[0]) return;
  await pool.query("INSERT INTO extras (name, price, category_id) VALUES ($1,$2,$3)", [
    name,
    price,
    categoryId,
  ]);
  console.log(`  + екстра "${name}" (${price.toFixed(2)} €)`);
}

async function addProductIfMissing(catId, p) {
  const existing = await pool.query(
    "SELECT id FROM products WHERE category_id = $1 AND name = $2",
    [catId, p.name]
  );
  if (existing.rows[0]) return existing.rows[0].id;
  const inserted = await pool.query(
    `INSERT INTO products (category_id, name, description, image, base_price, is_pizza, featured, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [
      catId,
      p.name,
      p.description || "",
      p.image || "",
      p.base_price,
      p.is_pizza ? 1 : 0,
      p.featured ? 1 : 0,
      p.sort_order ?? 0,
    ]
  );
  const productId = inserted.rows[0].id;
  const sizes = p.sizes || [{ label: "Стандартна", price_delta: 0, is_default: true }];
  for (let idx = 0; idx < sizes.length; idx++) {
    const s = sizes[idx];
    await pool.query(
      `INSERT INTO product_sizes (product_id, label, price_delta, is_default, sort_order)
       VALUES ($1,$2,$3,$4,$5)`,
      [productId, s.label, s.price_delta, s.is_default ? 1 : 0, idx]
    );
  }
  console.log(`  + продукт "${p.name}" (${p.base_price.toFixed(2)} €)`);
  return productId;
}

async function addPromoIfMissing(p) {
  const existing = await pool.query("SELECT id FROM promotions WHERE code = $1", [p.code]);
  if (existing.rows[0]) return;
  await pool.query(
    `INSERT INTO promotions (code, description, discount_type, discount_value, min_order, usage_limit)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [p.code, p.description, p.discount_type, p.discount_value, p.min_order, p.usage_limit]
  );
  console.log(`  + промо код "${p.code}"`);
}

async function addCourierIfMissing(c, passwordHash) {
  const existing = await pool.query("SELECT id FROM couriers WHERE phone = $1", [c.phone]);
  if (existing.rows[0]) return;
  await pool.query("INSERT INTO couriers (name, phone, password_hash) VALUES ($1,$2,$3)", [
    c.name,
    c.phone,
    passwordHash,
  ]);
  console.log(`  + куриер "${c.name}" (${c.phone})`);
}

async function main() {
  console.log("Добавяне на демо меню към базата данни...\n");

  const pizzaId = await categoryId("pizza", "Пици", "🍕", 1);
  const durumId = await categoryId("durum", "Дюнери", "🌯", 2);
  const burgersId = await categoryId("burgers", "Бургери", "🍔", 3);
  const sandwichesId = await categoryId("sandwiches", "Сандвичи", "🥪", 4);
  const pocketsId = await categoryId("pockets", "Джобове", "🥙", 5);

  console.log("\nЕкстри:");
  await addExtraIfMissing("Извара сирене", 0.8, null);
  await addExtraIfMissing("Кашкавал", 0.8, null);
  await addExtraIfMissing("Бекон", 1.0, null);
  await addExtraIfMissing("Халапеньо", 0.5, null);
  await addExtraIfMissing("Двойно месо", 1.5, durumId);
  await addExtraIfMissing("Двойно месо", 1.8, burgersId);
  await addExtraIfMissing("Пържени картофи (порция)", 1.3, null);
  await addExtraIfMissing("Чеснов сос", 0.4, null);
  await addExtraIfMissing("Люти чушки", 0.3, null);

  // Pizzas — two sizes: 32см / 40см (40cm priced the same +55% ratio as the
  // original demo used, computed off the new EUR base price)
  const pizzaSizes = (base) => [
    { label: "32см", price_delta: 0, is_default: true },
    { label: "40см", price_delta: Math.round(base * 0.55 * 100) / 100 },
  ];

  console.log("\nПици:");
  await addProductIfMissing(pizzaId, {
    name: "Маргарита",
    description: "Доматен сос, моцарела, босилек",
    base_price: 6.5,
    is_pizza: true,
    featured: true,
    sort_order: 1,
    sizes: pizzaSizes(6.5),
  });
  await addProductIfMissing(pizzaId, {
    name: "Четири сезона",
    description: "Шунка, гъби, маслини, артишок, моцарела",
    base_price: 8.1,
    is_pizza: true,
    sort_order: 2,
    sizes: pizzaSizes(8.1),
  });
  await addProductIfMissing(pizzaId, {
    name: "Пеперони",
    description: "Пикантен пеперони салам, моцарела, доматен сос",
    base_price: 7.9,
    is_pizza: true,
    featured: true,
    sort_order: 3,
    sizes: pizzaSizes(7.9),
  });
  await addProductIfMissing(pizzaId, {
    name: "Прошуто е Фунги",
    description: "Шунка прошуто, шампиньони, моцарела",
    base_price: 8.6,
    is_pizza: true,
    sort_order: 4,
    sizes: pizzaSizes(8.6),
  });
  await addProductIfMissing(pizzaId, {
    name: "Четири сирена",
    description: "Моцарела, горгонзола, пармезан, кашкавал",
    base_price: 8.4,
    is_pizza: true,
    sort_order: 5,
    sizes: pizzaSizes(8.4),
  });
  await addProductIfMissing(pizzaId, {
    name: "Барбекю Чикън",
    description: "Пилешко филе, царевица, лук, барбекю сос, моцарела",
    base_price: 8.9,
    is_pizza: true,
    featured: true,
    sort_order: 6,
    sizes: pizzaSizes(8.9),
  });
  await addProductIfMissing(pizzaId, {
    name: "Капричоза",
    description: "Шунка, гъби, маслини, моцарела, доматен сос",
    base_price: 8.1,
    is_pizza: true,
    sort_order: 7,
    sizes: pizzaSizes(8.1),
  });
  await addProductIfMissing(pizzaId, {
    name: "Диаволо",
    description: "Пикантен салам, люти чушки, халапеньо, моцарела",
    base_price: 8.6,
    is_pizza: true,
    sort_order: 8,
    sizes: pizzaSizes(8.6),
  });

  console.log("\nДюнери:");
  await addProductIfMissing(durumId, {
    name: "Дюнер Класик - Пилешко",
    description: "Пилешко месо, зеле, домат, лук, дюнер сос, лаваш",
    base_price: 4.3,
    featured: true,
    sort_order: 1,
    sizes: [
      { label: "Малък", price_delta: 0, is_default: true },
      { label: "Голям (XXL)", price_delta: 1.5 },
    ],
  });
  await addProductIfMissing(durumId, {
    name: "Дюнер Класик - Телешко",
    description: "Телешко месо, зеле, домат, лук, дюнер сос, лаваш",
    base_price: 4.9,
    sort_order: 2,
    sizes: [
      { label: "Малък", price_delta: 0, is_default: true },
      { label: "Голям (XXL)", price_delta: 1.5 },
    ],
  });
  await addProductIfMissing(durumId, {
    name: "Дюнер Микс (пилешко + телешко)",
    description: "Комбинирано месо, зеле, домат, лук, чесново-йогуртов сос",
    base_price: 5.4,
    featured: true,
    sort_order: 3,
    sizes: [
      { label: "Малък", price_delta: 0, is_default: true },
      { label: "Голям (XXL)", price_delta: 1.8 },
    ],
  });
  await addProductIfMissing(durumId, {
    name: "Дюнер Чиз",
    description: "Пилешко месо, разтопено сирене чедър, зеленчуци, сос",
    base_price: 5.1,
    sort_order: 4,
  });
  await addProductIfMissing(durumId, {
    name: "Вегетариански Дюнер",
    description: "Печени зеленчуци, фалафел, зеле, доматен сос",
    base_price: 4.5,
    sort_order: 5,
  });

  console.log("\nБургери:");
  await addProductIfMissing(burgersId, {
    name: "Чийзбургер",
    description: "150г телешко кюфте, чедър, маруля, домат, кисели краставички",
    base_price: 5.1,
    featured: true,
    sort_order: 1,
  });
  await addProductIfMissing(burgersId, {
    name: "Дабъл Бекон Бургер",
    description: "2x150г кюфте, бекон, чедър, карамелизиран лук, BBQ сос",
    base_price: 7.6,
    featured: true,
    sort_order: 2,
  });
  await addProductIfMissing(burgersId, {
    name: "Пилешки Крънчи Бургер",
    description: "Панирано пилешко филе, маруля, майонеза, кисели краставички",
    base_price: 5.4,
    sort_order: 3,
  });
  await addProductIfMissing(burgersId, {
    name: "Вегетариански Бургер",
    description: "Кюфте от нахут и зеленчуци, авокадо, маруля, домат",
    base_price: 5.6,
    sort_order: 4,
  });
  await addProductIfMissing(burgersId, {
    name: "Класик Хамбургер",
    description: "150г телешко кюфте, маруля, домат, лук, кетчуп, горчица",
    base_price: 4.5,
    sort_order: 5,
  });

  console.log("\nСандвичи:");
  await addProductIfMissing(sandwichesId, {
    name: "Клуб Сандвич",
    description: "Пилешко филе, бекон, яйце, маруля, домат, майонеза, тост хляб",
    base_price: 4.5,
    featured: true,
    sort_order: 1,
  });
  await addProductIfMissing(sandwichesId, {
    name: "Сандвич с Шунка и Сирене",
    description: "Шунка, кашкавал, масло, багета",
    base_price: 3.5,
    sort_order: 2,
  });
  await addProductIfMissing(sandwichesId, {
    name: "Тон Сандвич",
    description: "Риба тон, царевица, майонеза, маруля, багета",
    base_price: 4.0,
    sort_order: 3,
  });
  await addProductIfMissing(sandwichesId, {
    name: "Кайма Сандвич",
    description: "Пикантна кайма, сирене, люти чушки, багета",
    base_price: 3.8,
    sort_order: 4,
  });

  console.log("\nДжобове:");
  await addProductIfMissing(pocketsId, {
    name: "Джоб с Кайма и Сирене",
    description: "Пикантна кайма, извара сирене, домати, в пухкаво тесто",
    base_price: 3.3,
    featured: true,
    sort_order: 1,
  });
  await addProductIfMissing(pocketsId, {
    name: "Джоб с Пиле и Гъби",
    description: "Пилешко филе, гъби, кашкавал, сметанов сос",
    base_price: 3.5,
    sort_order: 2,
  });
  await addProductIfMissing(pocketsId, {
    name: "Джоб със Сирене и Спанак",
    description: "Извара сирене, пресен спанак, яйце",
    base_price: 3.0,
    sort_order: 3,
  });
  await addProductIfMissing(pocketsId, {
    name: "Джоб Пеперони",
    description: "Пеперони салам, моцарела, доматен сос",
    base_price: 3.5,
    sort_order: 4,
  });

  console.log("\nПромо кодове:");
  await addPromoIfMissing({
    code: "DOBREDOSHAL10",
    description: "10% отстъпка за нови клиенти",
    discount_type: "percent",
    discount_value: 10,
    min_order: 7.5,
    usage_limit: null,
  });
  await addPromoIfMissing({
    code: "VARNA5",
    description: "2.50 € отстъпка над 20 € поръчка",
    discount_type: "fixed",
    discount_value: 2.5,
    min_order: 20,
    usage_limit: null,
  });

  console.log("\nДемо куриери:");
  const bcrypt = await import("bcryptjs");
  const courierPassword = process.env.SEED_COURIER_PASSWORD || "Kurier2026!";
  const courierPasswordHash = bcrypt.default.hashSync(courierPassword, 10);
  await addCourierIfMissing({ name: "Георги Петров", phone: "0888111111" }, courierPasswordHash);
  await addCourierIfMissing({ name: "Мартин Иванов", phone: "0888222222" }, courierPasswordHash);
  console.log(`  (парола за демо куриерите: ${courierPassword})`);

  console.log("\n✅ Готово.");
  const counts = await pool.query(
    `SELECT (SELECT COUNT(*) FROM categories) categories,
            (SELECT COUNT(*) FROM products) products,
            (SELECT COUNT(*) FROM promotions) promotions,
            (SELECT COUNT(*) FROM couriers) couriers`
  );
  console.log(counts.rows[0]);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
