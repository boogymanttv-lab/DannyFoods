import { Pool, type PoolClient, types } from "pg";
import { AsyncLocalStorage } from "node:async_hooks";

types.setTypeParser(20, (val: string) => parseInt(val, 10));
import { SCHEMA_SQL } from "@/lib/schema";
import { approximateZoneCenter, VARNA_NEW_NEIGHBORHOODS } from "@/lib/varna-geo";

function toPlain<T>(row: T): T {
  return row == null ? row : ({ ...(row as object) } as T);
}

export type PlainStatement = {
  run(
    ...params: unknown[]
  ): Promise<{ lastInsertRowid: number | bigint; changes: number | bigint }>;
  get(...params: unknown[]): Promise<Record<string, unknown> | undefined>;
  all(...params: unknown[]): Promise<Record<string, unknown>[]>;
};

export type DbHandle = {
  exec(sql: string): Promise<void>;
  prepare(sql: string): PlainStatement;
  transaction<Args extends unknown[], R>(
    fn: (...args: Args) => Promise<R>
  ): (...args: Args) => Promise<R>;
};

declare global {
  var __danidunner_pool__: Pool | undefined;
  var __danidunner_ready__: Promise<void> | undefined;
}

const txContext = new AsyncLocalStorage<PoolClient>();

function getPool(): Pool {
  if (!global.__danidunner_pool__) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        "DATABASE_URL is not set. Add your Supabase (or other Postgres) connection string as an environment variable."
      );
    }
    global.__danidunner_pool__ = new Pool({
      connectionString,
      ssl: /sslmode=require|supabase\.co/.test(connectionString)
        ? { rejectUnauthorized: false }
        : undefined,
    });
  }
  return global.__danidunner_pool__;
}

async function rawQuery(text: string, values: unknown[]) {
  const client = txContext.getStore();
  if (client) return client.query(text, values);
  return getPool().query(text, values);
}

function translateSql(sql: string): { text: string; namedKeys: string[] | null } {
  if (/@[A-Za-z_][A-Za-z0-9_]*/.test(sql)) {
    const namedKeys: string[] = [];
    const seen = new Map<string, number>();
    const text = sql.replace(/@([A-Za-z_][A-Za-z0-9_]*)/g, (_match, key: string) => {
      let idx = seen.get(key);
      if (idx == null) {
        namedKeys.push(key);
        idx = namedKeys.length;
        seen.set(key, idx);
      }
      return `$${idx}`;
    });
    return { text, namedKeys };
  }
  if (sql.includes("?")) {
    let i = 0;
    const text = sql.replace(/\?/g, () => `$${++i}`);
    return { text, namedKeys: null };
  }
  return { text: sql, namedKeys: null };
}

function buildValues(
  params: unknown[],
  namedKeys: string[] | null,
  placeholderCount: number
): unknown[] {
  if (namedKeys) {
    const obj = (params[0] ?? {}) as Record<string, unknown>;
    return namedKeys.map((k) => (obj[k] === undefined ? null : obj[k]));
  }
  if (placeholderCount === 0) return [];
  return params;
}

const TABLES_WITHOUT_ID = new Set(["site_settings"]);

function prepare(sql: string): PlainStatement {
  const { text, namedKeys } = translateSql(sql);
  const placeholderCount = namedKeys ? namedKeys.length : (text.match(/\$\d+/g) ?? []).length;
  const insertMatch = sql.match(/^\s*INSERT\s+INTO\s+([A-Za-z_][A-Za-z0-9_]*)/i);
  const isInsert =
    insertMatch != null &&
    !/\bRETURNING\b/i.test(sql) &&
    !TABLES_WITHOUT_ID.has(insertMatch[1]);
  const finalText = isInsert ? `${text} RETURNING id` : text;

  return {
    async run(...params) {
      const values = buildValues(params, namedKeys, placeholderCount);
      const result = await rawQuery(finalText, values);
      const lastInsertRowid =
        isInsert && result.rows[0]?.id != null ? Number(result.rows[0].id) : 0;
      return { lastInsertRowid, changes: result.rowCount ?? 0 };
    },
    async get(...params) {
      const values = buildValues(params, namedKeys, placeholderCount);
      const result = await rawQuery(text, values);
      return result.rows[0] ? toPlain(result.rows[0]) : undefined;
    },
    async all(...params) {
      const values = buildValues(params, namedKeys, placeholderCount);
      const result = await rawQuery(text, values);
      return result.rows.map(toPlain);
    },
  };
}

async function exec(sql: string): Promise<void> {
  await rawQuery(sql, []);
}

function transaction<Args extends unknown[], R>(
  fn: (...args: Args) => Promise<R>
): (...args: Args) => Promise<R> {
  return async (...args: Args): Promise<R> => {
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      const result = await txContext.run(client, () => fn(...args));
      await client.query("COMMIT");
      return result;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  };
}

function splitLegacyAddress(address: string): { street: string; house_number: string } {
  const trimmed = address.trim();
  if (!trimmed) return { street: "", house_number: "" };
  const parts = trimmed.split(/\s+/);
  const last = parts[parts.length - 1];
  if (parts.length > 1 && /\d/.test(last)) {
    return { street: parts.slice(0, -1).join(" "), house_number: last };
  }
  return { street: trimmed, house_number: "" };
}

async function backfillStreetSplit(table: "customer_addresses" | "orders") {
  const rows = (await rawQuery(
    `SELECT id, address FROM ${table} WHERE (street IS NULL OR street = '') AND address <> ''`,
    []
  )).rows as { id: number; address: string }[];
  if (rows.length === 0) return;
  for (const row of rows) {
    const { street, house_number } = splitLegacyAddress(row.address);
    await rawQuery(`UPDATE ${table} SET street = $1, house_number = $2 WHERE id = $3`, [
      street,
      house_number,
      row.id,
    ]);
  }
}

async function seedCompanyLegalInfo() {
  const defaults: Record<string, string> = {
    company_legal_name: "ГУСТОЗО 2 ООД",
    company_eik: "204914956",
    company_vat: "BG204914956",
    company_registered_address:
      "гр. Варна 9009, ж.к. Младост, ж.к. „Трошево“ бл. 51, вх. Б, ет. 2, ап. 25",
    site_domain: "cfxwebstudio.xyz",
    contact_email: "info@dannyfoods.bg",
  };
  const existing = new Set(
    ((await rawQuery("SELECT key FROM site_settings", [])).rows as { key: string }[]).map(
      (r) => r.key
    )
  );
  for (const [key, value] of Object.entries(defaults)) {
    if (existing.has(key)) continue;
    await rawQuery("INSERT INTO site_settings (key, value) VALUES ($1, $2)", [key, value]);
  }
}

async function seedDrinksCategory() {
  const existing = (await rawQuery("SELECT id FROM categories WHERE slug = 'napitki'", []))
    .rows[0] as { id: number } | undefined;
  if (existing) {
    await enableSuggestedCategoryIfUnset(existing.id);
    return;
  }

  const maxOrder = (await rawQuery("SELECT MAX(sort_order) as m FROM categories", [])).rows[0] as {
    m: number | null;
  };
  const sortOrder = (maxOrder.m ?? 0) + 1;

  const catResult = await rawQuery(
    "INSERT INTO categories (slug, name, icon, sort_order) VALUES ('napitki', 'Напитки', '🥤', $1) RETURNING id",
    [sortOrder]
  );
  const categoryId = Number(catResult.rows[0].id);

  const drinks: { name: string; price: number; sizeLabel: string }[] = [
    { name: "Кока-Кола 0.5л", price: 1.8, sizeLabel: "0.5л" },
    { name: "Фанта 0.5л", price: 1.8, sizeLabel: "0.5л" },
    { name: "Спрайт 0.5л", price: 1.8, sizeLabel: "0.5л" },
    { name: "Изворна вода 0.5л", price: 1.0, sizeLabel: "0.5л" },
    { name: "Айрян", price: 1.5, sizeLabel: "Стандарт" },
  ];

  for (const [idx, drink] of drinks.entries()) {
    const productResult = await rawQuery(
      `INSERT INTO products (category_id, name, base_price, sort_order)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [categoryId, drink.name, drink.price, idx]
    );
    const productId = Number(productResult.rows[0].id);
    await rawQuery(
      `INSERT INTO product_sizes (product_id, label, price_delta, is_default, sort_order)
       VALUES ($1, $2, 0, 1, 0)`,
      [productId, drink.sizeLabel]
    );
  }

  await enableSuggestedCategoryIfUnset(categoryId);
}

async function enableSuggestedCategoryIfUnset(categoryId: number) {
  const row = (
    await rawQuery("SELECT value FROM site_settings WHERE key = 'suggested_category_id'", [])
  ).rows[0];
  if (row) return;
  await rawQuery(
    "INSERT INTO site_settings (key, value) VALUES ('suggested_category_id', $1)",
    [String(categoryId)]
  );
}

async function runMigrations() {
  await backfillStreetSplit("customer_addresses");
  await backfillStreetSplit("orders");

  await rawQuery("UPDATE delivery_zones SET delivery_fee = 2.5", []);

  const existingZoneNames = new Set(
    (
      (await rawQuery("SELECT name FROM delivery_zones", [])).rows as { name: string }[]
    ).map((z) => z.name.trim().toLowerCase())
  );
  const minOrderRow = (
    await rawQuery("SELECT value FROM site_settings WHERE key = 'min_order_global'", [])
  ).rows[0] as { value: string } | undefined;
  const defaultMinOrder = minOrderRow ? Number(minOrderRow.value) || 15 : 15;
  const maxSortOrder =
    ((await rawQuery("SELECT MAX(sort_order) as m FROM delivery_zones", [])).rows[0] as {
      m: number | null;
    }).m ?? 0;
  let nextSortOrder = maxSortOrder + 1;
  for (const name of VARNA_NEW_NEIGHBORHOODS) {
    if (existingZoneNames.has(name.trim().toLowerCase())) continue;
    await rawQuery(
      `INSERT INTO delivery_zones (name, delivery_fee, min_order, sort_order)
       VALUES ($1, 2.5, $2, $3)`,
      [name, defaultMinOrder, nextSortOrder]
    );
    nextSortOrder += 1;
  }

  const missing = (
    await rawQuery(
      `SELECT o.id as id, z.name as zone_name
       FROM orders o LEFT JOIN delivery_zones z ON z.id = o.zone_id
       WHERE o.dest_lat IS NULL`,
      []
    )
  ).rows as { id: number; zone_name: string | null }[];
  for (const row of missing) {
    const coords = approximateZoneCenter(row.zone_name);
    await rawQuery("UPDATE orders SET dest_lat = $1, dest_lng = $2 WHERE id = $3", [
      coords.lat,
      coords.lng,
      row.id,
    ]);
  }

  await seedCompanyLegalInfo();
  await seedDrinksCategory();

  await rawQuery(
    `ALTER TABLE orders
       ADD COLUMN IF NOT EXISTS pizza_transfer_id TEXT,
       ADD COLUMN IF NOT EXISTS pizza_transfer_amount REAL,
       ADD COLUMN IF NOT EXISTS pizza_transfer_status TEXT,
       ADD COLUMN IF NOT EXISTS pizza_transfer_error TEXT`,
    []
  );

  await rawQuery(
    `ALTER TABLE product_sizes ADD COLUMN IF NOT EXISTS weight_label TEXT DEFAULT ''`,
    []
  );

  await rawQuery(
    `ALTER TABLE orders
       ADD COLUMN IF NOT EXISTS quarter TEXT DEFAULT '',
       ADD COLUMN IF NOT EXISTS order_type TEXT NOT NULL DEFAULT 'delivery'`,
    []
  );
  await rawQuery(
    `ALTER TABLE customer_addresses ADD COLUMN IF NOT EXISTS quarter TEXT DEFAULT ''`,
    []
  );

  await rawQuery(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS email TEXT DEFAULT ''`, []);

  await rawQuery(
    `CREATE TABLE IF NOT EXISTS product_reviews (
       id SERIAL PRIMARY KEY,
       product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
       customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
       order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
       rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
       comment TEXT DEFAULT '',
       created_at TEXT NOT NULL DEFAULT (to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')),
       updated_at TEXT NOT NULL DEFAULT (to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS'))
     )`,
    []
  );
  await rawQuery(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_customer_product ON product_reviews(customer_id, product_id)`,
    []
  );
  await rawQuery(
    `CREATE INDEX IF NOT EXISTS idx_reviews_product ON product_reviews(product_id)`,
    []
  );

  await rawQuery(
    `CREATE TABLE IF NOT EXISTS promo_cards (
       id SERIAL PRIMARY KEY,
       position INTEGER NOT NULL UNIQUE CHECK (position BETWEEN 1 AND 4),
       active INTEGER NOT NULL DEFAULT 0,
       title TEXT NOT NULL DEFAULT '',
       subtitle TEXT NOT NULL DEFAULT '',
       description TEXT NOT NULL DEFAULT ''
     )`,
    []
  );
  await rawQuery(
    `INSERT INTO promo_cards (position) VALUES (1), (2), (3), (4)
     ON CONFLICT (position) DO NOTHING`,
    []
  );
  await rawQuery(
    `ALTER TABLE promo_cards
       ADD COLUMN IF NOT EXISTS image TEXT NOT NULL DEFAULT '',
       ADD COLUMN IF NOT EXISTS badge TEXT NOT NULL DEFAULT '',
       ADD COLUMN IF NOT EXISTS full_banner INTEGER NOT NULL DEFAULT 0`,
    []
  );

  await rawQuery(
    `ALTER TABLE products
       ADD COLUMN IF NOT EXISTS is_combo INTEGER NOT NULL DEFAULT 0,
       ADD COLUMN IF NOT EXISTS combo_discount_percent REAL NOT NULL DEFAULT 0`,
    []
  );
  await rawQuery(
    `CREATE TABLE IF NOT EXISTS combo_items (
       id SERIAL PRIMARY KEY,
       combo_product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
       product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
       size_id INTEGER REFERENCES product_sizes(id) ON DELETE SET NULL,
       quantity INTEGER NOT NULL DEFAULT 1,
       sort_order INTEGER NOT NULL DEFAULT 0
     )`,
    []
  );
  await rawQuery(
    `CREATE INDEX IF NOT EXISTS idx_combo_items_combo ON combo_items(combo_product_id)`,
    []
  );

  await rawQuery(
    `ALTER TABLE promo_cards
       ADD COLUMN IF NOT EXISTS linked_product_id INTEGER REFERENCES products(id) ON DELETE SET NULL`,
    []
  );

  await rawQuery(
    `UPDATE site_settings SET value = 'Гладен? Доставяме бързо.'
     WHERE key = 'tagline'
       AND value = 'Пица, Дюнери, Бургери, Сандвичи и Джобове с бърза доставка във Варна'`,
    []
  );

  await rawQuery(
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS review_reminder_sent_at TEXT`,
    []
  );

  await rawQuery(
    `ALTER TABLE categories ADD COLUMN IF NOT EXISTS name_en TEXT NOT NULL DEFAULT ''`,
    []
  );
  await rawQuery(
    `ALTER TABLE products
       ADD COLUMN IF NOT EXISTS name_en TEXT NOT NULL DEFAULT '',
       ADD COLUMN IF NOT EXISTS description_en TEXT NOT NULL DEFAULT ''`,
    []
  );
  await rawQuery(
    `ALTER TABLE promo_cards
       ADD COLUMN IF NOT EXISTS title_en TEXT NOT NULL DEFAULT '',
       ADD COLUMN IF NOT EXISTS description_en TEXT NOT NULL DEFAULT ''`,
    []
  );
  await rawQuery(
    `ALTER TABLE customers ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT`,
    []
  );
  await rawQuery(
    `ALTER TABLE extras ADD COLUMN IF NOT EXISTS product_id INTEGER REFERENCES products(id) ON DELETE CASCADE`,
    []
  );
  await rawQuery(
    `ALTER TABLE admin_users
       ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'owner',
       ADD COLUMN IF NOT EXISTS station TEXT NOT NULL DEFAULT 'all'`,
    []
  );
  await rawQuery(
    `ALTER TABLE orders
       ADD COLUMN IF NOT EXISTS station_pizza_ready INTEGER NOT NULL DEFAULT 0,
       ADD COLUMN IF NOT EXISTS station_other_ready INTEGER NOT NULL DEFAULT 0`,
    []
  );
  await rawQuery(
    `ALTER TABLE orders
       ADD COLUMN IF NOT EXISTS station_pizza_prep_estimate TEXT,
       ADD COLUMN IF NOT EXISTS station_pizza_prep_started_at TEXT,
       ADD COLUMN IF NOT EXISTS station_other_prep_estimate TEXT,
       ADD COLUMN IF NOT EXISTS station_other_prep_started_at TEXT`,
    []
  );
}

async function ensureReady(): Promise<void> {
  if (!global.__danidunner_ready__) {
    global.__danidunner_ready__ = (async () => {
      await exec(SCHEMA_SQL);
      await runMigrations();
    })();
  }
  await global.__danidunner_ready__;
}

export async function getDb(): Promise<DbHandle> {
  await ensureReady();
  return { exec, prepare, transaction };
}
