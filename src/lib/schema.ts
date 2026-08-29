// Postgres schema, as one SQL string executed on every cold start (each
// statement is idempotent — CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT
// EXISTS — so re-running it against an already-set-up database is a no-op).
//
// This used to be a separate schema.sql file loaded via fs.readFileSync, but
// on Vercel's serverless functions an arbitrary file read at runtime isn't
// guaranteed to be included in the deployment bundle (Next.js only traces
// files it can see imported/required in code). Inlining the SQL as a plain
// string constant sidesteps that entirely.
//
// All the columns that used to be added later via ALTER TABLE (courier_id,
// dest_lat/lng, customer_id, estimated_delivery, street/house_number/
// intercom, ...) are included directly here, since this schema targets a
// fresh Postgres database (Supabase) with no pre-existing SQLite history to
// carry forward column-by-column.
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  icon TEXT DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  image TEXT DEFAULT '',
  base_price REAL NOT NULL,
  is_pizza INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  featured INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS'))
);

-- Sizes per product (e.g. pizza 32cm/40cm, or a single default size for burgers)
CREATE TABLE IF NOT EXISTS product_sizes (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  price_delta REAL NOT NULL DEFAULT 0,
  is_default INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  -- Free-text serving size / weight for THIS size (e.g. "300г", "1.2кг",
  -- "2 броя") — each size (Малка/Голяма/Фамилна...) can have its own,
  -- purely informational, doesn't affect pricing.
  weight_label TEXT DEFAULT ''
);

-- Extras / addons, shared pool, linked to categories they apply to
CREATE TABLE IF NOT EXISTS extras (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  price REAL NOT NULL DEFAULT 0,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  active INTEGER NOT NULL DEFAULT 1
);

-- Variants of one extra (e.g. "Шунка" offered as 50г/100г/150г/200г, each
-- with its own price) — an extra with no rows here is just a single flat
-- price/click, exactly as before; one with rows here shows a picker instead.
CREATE TABLE IF NOT EXISTS extra_options (
  id SERIAL PRIMARY KEY,
  extra_id INTEGER NOT NULL REFERENCES extras(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  price REAL NOT NULL DEFAULT 0,
  is_default INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS delivery_zones (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  delivery_fee REAL NOT NULL DEFAULT 3,
  min_order REAL NOT NULL DEFAULT 15,
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS promotions (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  description TEXT DEFAULT '',
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percent','fixed')),
  discount_value REAL NOT NULL,
  min_order REAL NOT NULL DEFAULT 0,
  starts_at TEXT,
  ends_at TEXT,
  usage_limit INTEGER,
  used_count INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS'))
);

CREATE TABLE IF NOT EXISTS couriers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  last_lat REAL,
  last_lng REAL,
  last_location_at TEXT,
  created_at TEXT NOT NULL DEFAULT (to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS'))
);

CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT DEFAULT '',
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  google_id TEXT UNIQUE,
  avatar_url TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS'))
);

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  order_number TEXT UNIQUE NOT NULL,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  zone_id INTEGER REFERENCES delivery_zones(id),
  -- Free-typed neighborhood name (replaced the old zone dropdown — every
  -- zone ended up with the same flat delivery fee anyway, so the dropdown's
  -- per-zone price/minimum text was just confusing). Still used to bias the
  -- geocoder toward the right part of Varna, same as zone.name used to be.
  quarter TEXT DEFAULT '',
  -- 'pickup' orders skip the whole delivery address section — the customer
  -- collects the food themselves, so there's nothing to geocode or hand to
  -- a courier for these.
  order_type TEXT NOT NULL DEFAULT 'delivery' CHECK (order_type IN ('delivery','pickup')),
  address TEXT NOT NULL,
  street TEXT DEFAULT '',
  house_number TEXT DEFAULT '',
  intercom TEXT DEFAULT '',
  address_notes TEXT DEFAULT '',
  items_json TEXT NOT NULL,
  subtotal REAL NOT NULL,
  delivery_fee REAL NOT NULL DEFAULT 0,
  discount REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL,
  promo_code TEXT,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash','card_on_delivery','stripe')),
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending','paid','failed')),
  stripe_session_id TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','confirmed','preparing','delivering','delivered','cancelled')),
  courier_id INTEGER REFERENCES couriers(id) ON DELETE SET NULL,
  claimed_at TEXT,
  delivered_at TEXT,
  dest_lat REAL,
  dest_lng REAL,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  estimated_delivery TEXT,
  estimated_delivery_set_at TEXT,
  requested_time TEXT,
  notes TEXT DEFAULT '',
  -- Automatic split-payout tracking (pizza items' share of a card payment,
  -- transferred via Stripe Connect to a second connected account — see
  -- src/lib/pizza-split.ts). NULL/'' means "not applicable or not yet run".
  pizza_transfer_id TEXT,
  pizza_transfer_amount REAL,
  pizza_transfer_status TEXT,
  pizza_transfer_error TEXT,
  created_at TEXT NOT NULL DEFAULT (to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')),
  updated_at TEXT NOT NULL DEFAULT (to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS'))
);

CREATE TABLE IF NOT EXISTS customer_addresses (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT 'Адрес',
  zone_id INTEGER REFERENCES delivery_zones(id) ON DELETE SET NULL,
  quarter TEXT DEFAULT '',
  address TEXT NOT NULL,
  street TEXT DEFAULT '',
  house_number TEXT DEFAULT '',
  intercom TEXT DEFAULT '',
  address_notes TEXT DEFAULT '',
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS'))
);

CREATE TABLE IF NOT EXISTS admin_users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT 'Admin',
  created_at TEXT NOT NULL DEFAULT (to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS'))
);

CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_extra_options_extra ON extra_options(extra_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_courier ON orders(courier_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
`;
