import { Pool, type PoolClient, types } from "pg";
import { AsyncLocalStorage } from "node:async_hooks";

// node-postgres returns BIGINT (OID 20) columns — e.g. COUNT(*) — as strings
// by default, since JS numbers can't safely hold the full bigint range. This
// app's counts/ids never get remotely close to that, and the repo layer
// already expects plain numbers (as node:sqlite always returned), so parse
// them as numbers globally rather than special-casing every COUNT(*) call.
types.setTypeParser(20, (val: string) => parseInt(val, 10));
import { SCHEMA_SQL } from "@/lib/schema";
import { approximateZoneCenter, VARNA_NEW_NEIGHBORHOODS } from "@/lib/varna-geo";

// Postgres (Supabase in production) via node-postgres. This replaced a local
// node:sqlite file — that only worked for a single long-running dev server;
// on Vercel every request can land on a different, disposable serverless
// instance with no shared disk, so the data needs to live in a real
// database reachable over the network.
//
// Because Postgres access is inherently async (network round-trips, unlike
// a synchronous local file), every repo function that used to call
// getDb() synchronously now awaits it, and so does everything that calls
// those repo functions — Server Components, API routes, this file's own
// migrations. That's the one structural change this migration forces
// throughout the app; see AGENTS.md/CLAUDE.md if this comment is stale.

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

// Holds the dedicated client for the duration of a transaction() call, so
// that prepare()'d statements run *inside* fn() reuse that same connection
// (and therefore the same BEGIN/COMMIT) instead of grabbing an unrelated
// connection from the pool — see transaction() below.
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
      // Supabase's pooled connection requires TLS but uses a certificate
      // chain Node doesn't have bundled; rejectUnauthorized:false still
      // encrypts the connection, it just skips CA verification. Local/dev
      // Postgres (no sslmode in the URL) doesn't use TLS at all.
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

// Translates this codebase's two SQLite-era parameter styles into
// Postgres's positional $1, $2... style:
//   - named:     "... WHERE id = @id"        called as .run({ id })
//   - positional:"... WHERE id = ?"          called as .get(id)
// Whichever style a given SQL string uses is fixed by the text itself, not
// by what's passed at call time, so this only needs to look at the SQL.
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

// node:sqlite's named-parameter binding only ever looked at the keys a
// query text actually referenced, silently ignoring any other keys (or a
// whole params object) passed alongside — several repo functions build a
// params object unconditionally and only populate it when a dynamic WHERE
// clause needs a value, so a query that ends up with zero placeholders can
// still be called with a (now-empty) params object. Postgres's positional
// binding has no such tolerance: it errors if the value count doesn't
// exactly match the placeholder count in the query. So when a query has no
// placeholders at all, any params passed are leftover/unused and must be
// dropped rather than forwarded, to match the old permissive behavior.
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

// site_settings is the one table in the schema keyed by "key" (text) rather
// than a serial "id" — appending "RETURNING id" to an INSERT against it
// would fail with "column \"id\" does not exist", so it's excluded from the
// auto-RETURNING behavior below.
const TABLES_WITHOUT_ID = new Set(["site_settings"]);

function prepare(sql: string): PlainStatement {
  const { text, namedKeys } = translateSql(sql);
  const placeholderCount = namedKeys ? namedKeys.length : (text.match(/\$\d+/g) ?? []).length;
  // Every other table here has a serial "id" primary key. Postgres doesn't
  // hand back a lastInsertRowid the way node:sqlite did, so every INSERT
  // (that doesn't already have its own RETURNING) gets "RETURNING id"
  // appended — this lets every existing `.run(...).lastInsertRowid` call
  // site in the repo files keep working completely unchanged.
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
  // schema.ts / one-off migration blocks sometimes send several ";"
  // separated statements in one exec() call, same as node:sqlite's exec()
  // did — pg's simple query protocol (used when no $ placeholders are
  // present) supports that natively.
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

// Splits an old combined "address" string into street + house number,
// best-effort: the last whitespace-separated token that contains a digit is
// treated as the number, everything before it as the street.
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

// Backfills street/house_number for any row that only has the old combined
// "address" text (harmless no-op on a fresh database with nothing to fix).
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

// One-time seed of the real company/legal details gathered directly from the
// site owner (Густозо 2 ООД) — only inserted the first time each key doesn't
// exist yet in site_settings, so it never overwrites a value an admin has
// since edited from Настройки.
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

// One-time seed of a starter "Напитки" (drinks) category with a handful of
// sample products, so "Често купувано с" (Настройки → Често купувано с) has
// something to point at immediately.
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

// Turns "Често купувано с" on by default, pointing at the given category —
// only the very first time (i.e. only while the admin has never saved a
// value for this setting at all, explicit "Изключено" included).
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

// Adds retrofitted defaults/backfills that only matter for a database that
// already has rows in it — all guarded to be no-ops on a fresh database, so
// this list is safe to keep growing over time without needing a separate
// "has this run yet" flag for each one.
async function runMigrations() {
  await backfillStreetSplit("customer_addresses");
  await backfillStreetSplit("orders");

  // Every delivery zone costs a flat 2.50 € to deliver to, regardless of
  // neighborhood — re-applied on every startup so it also catches zones an
  // admin adds later.
  await rawQuery("UPDATE delivery_zones SET delivery_fee = 2.5", []);

  // Make sure every commonly-used Varna quarter exists as a pickable
  // delivery zone. Zones already present (matched by name, case-
  // insensitively) are left untouched; this only adds the ones missing.
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

  // Backfill an approximate destination point for any order that doesn't
  // have one yet (orders placed before geocoding existed, or that failed to
  // geocode) — otherwise the tracking map would show the courier alone.
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

  // Added for the Stripe Connect pizza payout split — safe no-op on a fresh
  // database (already in schema.ts's CREATE TABLE), needed here so an
  // already-deployed database picks up the new columns too.
  await rawQuery(
    `ALTER TABLE orders
       ADD COLUMN IF NOT EXISTS pizza_transfer_id TEXT,
       ADD COLUMN IF NOT EXISTS pizza_transfer_amount REAL,
       ADD COLUMN IF NOT EXISTS pizza_transfer_status TEXT,
       ADD COLUMN IF NOT EXISTS pizza_transfer_error TEXT`,
    []
  );

  // Free-text serving size / weight, per SIZE row (e.g. "300г") — a product
  // with Малка/Голяма/Фамилна sizes can label each one's weight separately.
  await rawQuery(
    `ALTER TABLE product_sizes ADD COLUMN IF NOT EXISTS weight_label TEXT DEFAULT ''`,
    []
  );

  // Checkout rework: a free-typed neighborhood field (replacing the old
  // per-zone dropdown) and a delivery-vs-pickup toggle. Existing rows get
  // 'delivery' — that's what every order before this change actually was.
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

  // Optional email collected at checkout — powers the Resend order
  // confirmation (see src/lib/email.ts). Existing orders simply have none.
  await rawQuery(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS email TEXT DEFAULT ''`, []);

  // Product reviews — safe no-op on a fresh database (already in
  // schema.ts's CREATE TABLE), needed here so an already-deployed database
  // picks up the new table too.
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

  // Homepage "showcase" promo cards — 4 fixed slots (already in schema.ts's
  // CREATE TABLE for a fresh database; needed here too for an
  // already-deployed one). Seeded once so all 4 rows always exist —
  // toggling one on/off in admin is then just an UPDATE, never an
  // INSERT/DELETE that could accidentally change how many slots there are.
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
  // "image" went through a drop-then-re-add across two rounds of this
  // feature (photo upload removed, then brought back) — ADD COLUMN IF NOT
  // EXISTS is safe regardless of which state an already-deployed database
  // is in. "badge" (small tag like "ХИТ ОФЕРТА") is new alongside it.
  await rawQuery(
    `ALTER TABLE promo_cards
       ADD COLUMN IF NOT EXISTS image TEXT NOT NULL DEFAULT '',
       ADD COLUMN IF NOT EXISTS badge TEXT NOT NULL DEFAULT ''`,
    []
  );

  // Shortened the homepage hero tagline — the old one just listed every
  // category name ("Пица, Дюнери, Бургери, Сандвичи и Джобове с бърза
  // доставка във Варна"), which read as long and cluttered next to the new
  // promo cards below it. Only swapped if it's still exactly the old
  // default — an admin who already customized this field keeps their own
  // wording untouched.
  await rawQuery(
    `UPDATE site_settings SET value = 'Гладен? Доставяме бързо.'
     WHERE key = 'tagline'
       AND value = 'Пица, Дюнери, Бургери, Сандвичи и Джобове с бърза доставка във Варна'`,
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
