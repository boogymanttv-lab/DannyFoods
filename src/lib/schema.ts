export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  name_en TEXT NOT NULL DEFAULT '',
  icon TEXT DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  name_en TEXT NOT NULL DEFAULT '',
  description_en TEXT NOT NULL DEFAULT '',
  image TEXT DEFAULT '',
  base_price REAL NOT NULL,
  is_pizza INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  featured INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_combo INTEGER NOT NULL DEFAULT 0,
  combo_discount_percent REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS'))
);

CREATE TABLE IF NOT EXISTS product_sizes (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  price_delta REAL NOT NULL DEFAULT 0,
  is_default INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  weight_label TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS extras (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  price REAL NOT NULL DEFAULT 0,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  active INTEGER NOT NULL DEFAULT 1
);

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
  stripe_customer_id TEXT,
  created_at TEXT NOT NULL DEFAULT (to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS'))
);

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  order_number TEXT UNIQUE NOT NULL,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT DEFAULT '',
  zone_id INTEGER REFERENCES delivery_zones(id),
  quarter TEXT DEFAULT '',
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
  pizza_transfer_id TEXT,
  pizza_transfer_amount REAL,
  pizza_transfer_status TEXT,
  pizza_transfer_error TEXT,
  review_reminder_sent_at TEXT,
  station_pizza_ready INTEGER NOT NULL DEFAULT 0,
  station_other_ready INTEGER NOT NULL DEFAULT 0,
  station_pizza_prep_estimate TEXT,
  station_pizza_prep_started_at TEXT,
  station_other_prep_estimate TEXT,
  station_other_prep_started_at TEXT,
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
  role TEXT NOT NULL DEFAULT 'owner' CHECK (role IN ('owner','staff')),
  station TEXT NOT NULL DEFAULT 'all' CHECK (station IN ('all','pizza','other')),
  created_at TEXT NOT NULL DEFAULT (to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS'))
);

CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS product_reviews (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')),
  updated_at TEXT NOT NULL DEFAULT (to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS'))
);

CREATE TABLE IF NOT EXISTS promo_cards (
  id SERIAL PRIMARY KEY,
  position INTEGER NOT NULL UNIQUE CHECK (position BETWEEN 1 AND 4),
  active INTEGER NOT NULL DEFAULT 0,
  badge TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  subtitle TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  title_en TEXT NOT NULL DEFAULT '',
  description_en TEXT NOT NULL DEFAULT '',
  image TEXT NOT NULL DEFAULT '',
  full_banner INTEGER NOT NULL DEFAULT 0,
  linked_product_id INTEGER REFERENCES products(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS combo_items (
  id SERIAL PRIMARY KEY,
  combo_product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  size_id INTEGER REFERENCES product_sizes(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS translations (
  id SERIAL PRIMARY KEY,
  hash TEXT UNIQUE NOT NULL,
  source TEXT NOT NULL,
  en TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS'))
);

CREATE INDEX IF NOT EXISTS idx_extra_options_extra ON extra_options(extra_id);
CREATE INDEX IF NOT EXISTS idx_combo_items_combo ON combo_items(combo_product_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_customer_product ON product_reviews(customer_id, product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_product ON product_reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_courier ON orders(courier_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
`;
