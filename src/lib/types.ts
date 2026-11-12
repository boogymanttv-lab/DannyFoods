export type Category = {
  id: number;
  slug: string;
  name: string;
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
  product_id: number | null;
  active: number;
  options: ExtraOption[];
};

export type Product = {
  id: number;
  category_id: number;
  name: string;
  description: string;
  name_en: string;
  description_en: string;
  image: string;
  base_price: number;
  is_pizza: number;
  active: number;
  featured: number;
  sort_order: number;
  is_combo: number;
  combo_discount_percent: number;
  created_at: string;
};

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
  sizeId?: number;
  unitPrice: number;
  quantity: number;
  extras: {
    name: string;
    price: number;
    id?: number;
    optionId?: number;
  }[];
  removed?: string[];
  lineTotal: number;
  components?: { name: string; sizeLabel?: string; quantity: number }[];
  is_pizza?: boolean;
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
  station_pizza_ready: number;
  station_other_ready: number;
  station_pizza_prep_estimate: string | null;
  station_pizza_prep_started_at: string | null;
  station_other_prep_estimate: string | null;
  station_other_prep_started_at: string | null;
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
  stripe_customer_id: string | null;
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
  extras: { id: number; name: string; price: number; optionId?: number }[];
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

export type ProductReviewPublic = ProductReview & { customer_name: string };

export type PromoCard = {
  id: number;
  position: number;
  active: number;
  badge: string;
  title: string;
  subtitle: string;
  description: string;
  title_en: string;
  description_en: string;
  image: string;
  full_banner: number;
  linked_product_id: number | null;
  linked_product_price: number | null;
};
