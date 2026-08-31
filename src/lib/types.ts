export type Category = {
  id: number;
  slug: string;
  name: string;
  // Auto-translated (DeepL) — empty means not yet translated; the EN site
  // falls back to `name` in that case (see src/lib/i18n/content.ts).
  name_en: string;
  icon: string;
  sort_order: number;
  active: number;
};

export type ProductSize = {
  id: number;
  product_id: number;
  label: string;
  price_delta: number;
  is_default: number;
  sort_order: number;
  weight_label: string;
};

export type ExtraOption = {
  id: number;
  extra_id: number;
  label: string;
  price: number;
  is_default: number;
  sort_order: number;
};

export type Extra = {
  id: number;
  name: string;
  price: number;
  category_id: number | null;
  active: number;
  // Weight/quantity variants (e.g. "50г", "100г" — each its own price) for
  // extras that aren't just a single flat add-on price. Empty for a plain
  // extra — see extra_options in schema.ts.
  options: ExtraOption[];
};

export type Product = {
  id: number;
  category_id: number;
  name: string;
  description: string;
  // Auto-translated (DeepL) — empty means not yet translated; falls back
  // to the Bulgarian text on the EN site (see src/lib/i18n/content.ts).
  name_en: string;
  description_en: string;
  image: string;
  base_price: number;
  is_pizza: number;
  active: number;
  featured: number;
  sort_order: number;
  // 1 = base_price is computed from combo_items (see ComboItem) minus
  // combo_discount_percent, rather than typed in directly. Customer-facing
  // pages never look at this — a combo orders exactly like any other
  // product.
  is_combo: number;
  combo_discount_percent: number;
  created_at: string;
};

// One component of a combo product (products.is_combo = 1) — an existing
// product, optionally at one of its own sizes, and how many of it go into
// the combo. Admin-only bill of materials, used to compute the combo's
// price.
export type ComboItem = {
  id: number;
  combo_product_id: number;
  product_id: number;
  size_id: number | null;
  quantity: number;
  sort_order: number;
};

export type ProductWithOptions = Product & {
  sizes: ProductSize[];
  extras: Extra[];
  category?: Category;
  // Only populated for combo products — empty for everything else.
  combo_items: ComboItem[];
};

export type DeliveryZone = {
  id: number;
  name: string;
  delivery_fee: number;
  min_order: number;
  active: number;
  sort_order: number;
};

export type Promotion = {
  id: number;
  code: string;
  description: string;
  discount_type: "percent" | "fixed";
  discount_value: number;
  min_order: number;
  starts_at: string | null;
  ends_at: string | null;
  usage_limit: number | null;
  used_count: number;
  active: number;
  created_at: string;
};

export type OrderStatus =
  | "new"
  | "confirmed"
  | "preparing"
  | "delivering"
  | "delivered"
  | "cancelled";

export type PaymentMethod = "cash" | "card_on_delivery" | "stripe";

export type OrderItem = {
  productId: number;
  name: string;
  sizeLabel?: string;
  // Kept alongside sizeLabel (which is just for display) so "Order again"
  // can rebuild the exact same cart line without re-matching by label text.
  sizeId?: number;
  unitPrice: number;
  quantity: number;
  extras: {
    name: string;
    price: number;
    // Same reasoning as sizeId — id/optionId aren't needed for display (the
    // name+price already show that), only to reconstruct the cart line.
    id?: number;
    optionId?: number;
  }[];
  // Ingredients (parsed from the product's description) the customer asked
  // to leave out — e.g. "Без сирене". No price effect, purely a note to the
  // kitchen/courier.
  removed?: string[];
  lineTotal: number;
  // Only set when this line is a combo product — a snapshot of its bill of
  // materials at order time (component product name/size + quantity PER
  // ONE combo unit), so staff preparing the order can see exactly what to
  // put together without needing to open the admin menu/showcase to look
  // it up. Snapshotted rather than looked up live because the combo's own
  // recipe could change later.
  components?: { name: string; sizeLabel?: string; quantity: number }[];
};

export type OrderType = "delivery" | "pickup";

export type Order = {
  id: number;
  order_number: string;
  customer_name: string;
  phone: string;
  email: string;
  zone_id: number | null;
  quarter: string;
  order_type: OrderType;
  address: string;
  street: string;
  house_number: string;
  intercom: string;
  address_notes: string;
  items_json: string;
  subtotal: number;
  delivery_fee: number;
  discount: number;
  total: number;
  promo_code: string | null;
  payment_method: PaymentMethod;
  payment_status: "pending" | "paid" | "failed";
  stripe_session_id: string | null;
  status: OrderStatus;
  courier_id: number | null;
  claimed_at: string | null;
  delivered_at: string | null;
  dest_lat: number | null;
  dest_lng: number | null;
  customer_id: number | null;
  estimated_delivery: string | null;
  estimated_delivery_set_at: string | null;
  requested_time: string | null;
  notes: string;
  pizza_transfer_id: string | null;
  pizza_transfer_amount: number | null;
  pizza_transfer_status: string | null;
  pizza_transfer_error: string | null;
  created_at: string;
  updated_at: string;
};

export type Courier = {
  id: number;
  name: string;
  phone: string;
  password_hash: string;
  active: number;
  last_lat: number | null;
  last_lng: number | null;
  last_location_at: string | null;
  created_at: string;
};

export type CourierPublic = Omit<Courier, "password_hash">;

export type Customer = {
  id: number;
  name: string;
  phone: string;
  email: string;
  password_hash: string | null;
  google_id: string | null;
  avatar_url: string;
  created_at: string;
};

export type CustomerPublic = Omit<Customer, "password_hash">;

export type CustomerAddress = {
  id: number;
  customer_id: number;
  label: string;
  zone_id: number | null;
  quarter: string;
  address: string;
  street: string;
  house_number: string;
  intercom: string;
  address_notes: string;
  is_default: number;
  created_at: string;
};

export type CartLine = {
  productId: number;
  name: string;
  image: string;
  sizeLabel?: string;
  sizeId?: number;
  unitPrice: number;
  quantity: number;
  // `id` is the extra's id; `optionId` is set when the customer picked one
  // of that extra's weight/quantity variants (see ExtraOption) rather than
  // its plain flat price.
  extras: { id: number; name: string; price: number; optionId?: number }[];
  // Ingredients (parsed from the product's description) the customer
  // unchecked in "Без —" — e.g. ["Сирене"]. No price effect.
  removedIngredients?: string[];
};

export type ProductReview = {
  id: number;
  product_id: number;
  customer_id: number;
  order_id: number | null;
  rating: number;
  comment: string;
  created_at: string;
  updated_at: string;
};

// Joined in for display — the reviewer's own name, never their contact info.
export type ProductReviewPublic = ProductReview & { customer_name: string };

// One of the 4 fixed homepage "showcase" slots (see promo_cards table) —
// position is the row's permanent identity, never reassigned.
export type PromoCard = {
  id: number;
  position: number;
  active: number;
  badge: string;
  title: string;
  subtitle: string;
  description: string;
  // Auto-translated (DeepL) — empty falls back to the Bulgarian text.
  title_en: string;
  description_en: string;
  image: string;
  // 1 = the image is itself a finished ad (own title/price already baked
  // in) — no text is overlaid on top and the photo is never cropped.
  full_banner: number;
  // Set when this card was built via the combo picker in its own form —
  // points at a hidden, non-listed product (is_combo = 1, active = 0) that
  // carries the actual components + computed price.
  linked_product_id: number | null;
  // Populated by a join in listPromoCards/listActivePromoCards — the linked
  // product's current price, straight from products.base_price. null when
  // there's no linked product.
  linked_product_price: number | null;
};
