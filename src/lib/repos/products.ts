import { getDb } from "@/lib/db";
import type {
  Product,
  ProductSize,
  Extra,
  ExtraOption,
  ProductWithOptions,
  ComboItem,
} from "@/lib/types";

async function attachExtraOptions(extra: Omit<Extra, "options">): Promise<Extra> {
  const db = await getDb();
  const options = (await db
    .prepare(
      "SELECT * FROM extra_options WHERE extra_id = ? ORDER BY sort_order ASC, id ASC"
    )
    .all(extra.id)) as ExtraOption[];
  return { ...extra, options };
}

async function attachOptions(product: Product): Promise<ProductWithOptions> {
  const db = await getDb();
  const sizes = (await db
    .prepare(
      "SELECT * FROM product_sizes WHERE product_id = ? ORDER BY sort_order ASC, id ASC"
    )
    .all(product.id)) as ProductSize[];
  const extrasRaw = (await db
    .prepare(
      `SELECT e.* FROM extras e
       WHERE e.active = 1 AND (e.category_id = ? OR e.category_id IS NULL)
       ORDER BY e.id ASC`
    )
    .all(product.category_id)) as Omit<Extra, "options">[];
  const extras = await Promise.all(extrasRaw.map(attachExtraOptions));
  // combo_items only matters for combo products — skip the query for the
  // overwhelming majority of plain products.
  const combo_items = product.is_combo
    ? ((await db
        .prepare(
          "SELECT * FROM combo_items WHERE combo_product_id = ? ORDER BY sort_order ASC, id ASC"
        )
        .all(product.id)) as ComboItem[])
    : [];
  return { ...product, sizes, extras, combo_items };
}

export async function listProducts(opts?: {
  categoryId?: number;
  activeOnly?: boolean;
  featuredOnly?: boolean;
}): Promise<ProductWithOptions[]> {
  const db = await getDb();
  const clauses: string[] = [];
  const params: Record<string, unknown> = {};
  if (opts?.activeOnly !== false) clauses.push("active = 1");
  if (opts?.categoryId) {
    clauses.push("category_id = @categoryId");
    params.categoryId = opts.categoryId;
  }
  if (opts?.featuredOnly) clauses.push("featured = 1");
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const products = (await db
    .prepare(`SELECT * FROM products ${where} ORDER BY sort_order ASC, id ASC`)
    .all(params)) as Product[];
  return Promise.all(products.map(attachOptions));
}

export async function getProduct(id: number): Promise<ProductWithOptions | undefined> {
  const db = await getDb();
  const product = (await db.prepare("SELECT * FROM products WHERE id = ?").get(id)) as
    | Product
    | undefined;
  if (!product) return undefined;
  return attachOptions(product);
}

export async function createProduct(data: {
  category_id: number;
  name: string;
  description?: string;
  image?: string;
  base_price: number;
  is_pizza?: boolean;
  featured?: boolean;
  // Defaults to true (matches the DB column default) — set false for a
  // product that shouldn't show up in the normal category menu, e.g. the
  // hidden product backing a combo-built promo card.
  active?: boolean;
  sort_order?: number;
  is_combo?: boolean;
  combo_discount_percent?: number;
}) {
  const db = await getDb();
  const info = await db
    .prepare(
      `INSERT INTO products (category_id, name, description, image, base_price, is_pizza, featured, active, sort_order, is_combo, combo_discount_percent)
       VALUES (@category_id, @name, @description, @image, @base_price, @is_pizza, @featured, @active, @sort_order, @is_combo, @combo_discount_percent)`
    )
    .run({
      category_id: data.category_id,
      name: data.name,
      description: data.description ?? "",
      image: data.image ?? "",
      base_price: data.base_price,
      is_pizza: data.is_pizza ? 1 : 0,
      featured: data.featured ? 1 : 0,
      active: data.active === false ? 0 : 1,
      sort_order: data.sort_order ?? 0,
      is_combo: data.is_combo ? 1 : 0,
      combo_discount_percent: data.combo_discount_percent ?? 0,
    });
  return info.lastInsertRowid as number;
}

export async function updateProduct(
  id: number,
  data: Partial<{
    category_id: number;
    name: string;
    description: string;
    image: string;
    base_price: number;
    is_pizza: boolean;
    active: boolean;
    featured: boolean;
    sort_order: number;
    is_combo: boolean;
    combo_discount_percent: number;
  }>
) {
  const db = await getDb();
  const payload: Record<string, unknown> = { ...data, id };
  if ("is_pizza" in data) payload.is_pizza = data.is_pizza ? 1 : 0;
  if ("active" in data) payload.active = data.active ? 1 : 0;
  if ("featured" in data) payload.featured = data.featured ? 1 : 0;
  if ("is_combo" in data) payload.is_combo = data.is_combo ? 1 : 0;
  const fields = Object.keys(data);
  if (fields.length === 0) return;
  const setClause = fields.map((f) => `${f} = @${f}`).join(", ");
  await db.prepare(`UPDATE products SET ${setClause} WHERE id = @id`).run(payload);
}

// Replaces a combo product's full bill of materials (delete + re-insert,
// same pattern as setProductSizes/setExtraOptions).
export async function setComboItems(
  comboProductId: number,
  items: { product_id: number; size_id: number | null; quantity: number }[]
) {
  const db = await getDb();
  const tx = db.transaction(async () => {
    await db.prepare("DELETE FROM combo_items WHERE combo_product_id = ?").run(comboProductId);
    const stmt = db.prepare(
      `INSERT INTO combo_items (combo_product_id, product_id, size_id, quantity, sort_order)
       VALUES (@combo_product_id, @product_id, @size_id, @quantity, @sort_order)`
    );
    for (const [idx, it] of items.entries()) {
      await stmt.run({
        combo_product_id: comboProductId,
        product_id: it.product_id,
        size_id: it.size_id,
        quantity: Math.max(1, Math.round(it.quantity)),
        sort_order: idx,
      });
    }
  });
  await tx();
}

// The combo's price is never trusted from the client — it's always
// recomputed here from each component's CURRENT base_price/size price_delta
// (so if a component's own price later changes, the combo's total isn't
// silently stale next time it's saved), summed and then discounted by
// combo_discount_percent, rounded to the cent.
export async function computeComboPrice(
  items: { product_id: number; size_id: number | null; quantity: number }[],
  discountPercent: number
): Promise<number> {
  if (items.length === 0) return 0;
  const db = await getDb();
  let sum = 0;
  for (const item of items) {
    const product = (await db
      .prepare("SELECT base_price FROM products WHERE id = ?")
      .get(item.product_id)) as { base_price: number } | undefined;
    if (!product) continue;
    let delta = 0;
    if (item.size_id) {
      const size = (await db
        .prepare("SELECT price_delta FROM product_sizes WHERE id = ?")
        .get(item.size_id)) as { price_delta: number } | undefined;
      delta = size?.price_delta ?? 0;
    }
    sum += (product.base_price + delta) * Math.max(1, Math.round(item.quantity));
  }
  const discounted = sum * (1 - discountPercent / 100);
  return Math.round(discounted * 100) / 100;
}

export async function deleteProduct(id: number) {
  const db = await getDb();
  await db.prepare("DELETE FROM products WHERE id = ?").run(id);
}

export async function setProductSizes(
  productId: number,
  sizes: {
    label: string;
    price_delta: number;
    is_default?: boolean;
    sort_order?: number;
    weight_label?: string;
  }[]
) {
  const db = await getDb();
  const tx = db.transaction(async () => {
    await db.prepare("DELETE FROM product_sizes WHERE product_id = ?").run(productId);
    const stmt = db.prepare(
      `INSERT INTO product_sizes (product_id, label, price_delta, is_default, sort_order, weight_label)
       VALUES (@product_id, @label, @price_delta, @is_default, @sort_order, @weight_label)`
    );
    for (const [idx, s] of sizes.entries()) {
      await stmt.run({
        product_id: productId,
        label: s.label,
        price_delta: s.price_delta,
        is_default: s.is_default ? 1 : 0,
        sort_order: s.sort_order ?? idx,
        weight_label: s.weight_label ?? "",
      });
    }
  });
  await tx();
}

export async function listExtras(categoryId?: number): Promise<Extra[]> {
  const db = await getDb();
  const rows = (categoryId
    ? await db
        .prepare(
          "SELECT * FROM extras WHERE active = 1 AND (category_id = ? OR category_id IS NULL) ORDER BY id ASC"
        )
        .all(categoryId)
    : await db.prepare("SELECT * FROM extras ORDER BY id ASC").all()) as Omit<
    Extra,
    "options"
  >[];
  return Promise.all(rows.map(attachExtraOptions));
}

export async function createExtra(data: {
  name: string;
  price: number;
  category_id?: number | null;
}) {
  const db = await getDb();
  const info = await db
    .prepare("INSERT INTO extras (name, price, category_id) VALUES (@name, @price, @category_id)")
    .run({ name: data.name, price: data.price, category_id: data.category_id ?? null });
  return info.lastInsertRowid as number;
}

export async function updateExtra(
  id: number,
  data: Partial<{ name: string; price: number; category_id: number | null; active: boolean }>
) {
  const db = await getDb();
  const payload: Record<string, unknown> = { ...data, id };
  if ("active" in data) payload.active = data.active ? 1 : 0;
  const fields = Object.keys(data);
  if (fields.length === 0) return;
  const setClause = fields.map((f) => `${f} = @${f}`).join(", ");
  await db.prepare(`UPDATE extras SET ${setClause} WHERE id = @id`).run(payload);
}

export async function deleteExtra(id: number) {
  const db = await getDb();
  await db.prepare("DELETE FROM extras WHERE id = ?").run(id);
}

export async function setExtraOptions(
  extraId: number,
  options: {
    label: string;
    price: number;
    is_default?: boolean;
    sort_order?: number;
  }[]
) {
  const db = await getDb();
  const tx = db.transaction(async () => {
    await db.prepare("DELETE FROM extra_options WHERE extra_id = ?").run(extraId);
    const stmt = db.prepare(
      `INSERT INTO extra_options (extra_id, label, price, is_default, sort_order)
       VALUES (@extra_id, @label, @price, @is_default, @sort_order)`
    );
    for (const [idx, o] of options.entries()) {
      await stmt.run({
        extra_id: extraId,
        label: o.label,
        price: o.price,
        is_default: o.is_default ? 1 : 0,
        sort_order: o.sort_order ?? idx,
      });
    }
  });
  await tx();
}

// Used by the Stripe Connect pizza payout split (src/lib/pizza-split.ts) to
// figure out, from a placed order's line items, which product ids are
// pizzas — returns just the subset of `ids` that are pizza products.
export async function getPizzaProductIds(ids: number[]): Promise<Set<number>> {
  if (ids.length === 0) return new Set();
  const db = await getDb();
  const rows = (await db
    .prepare("SELECT id FROM products WHERE id = ANY(?) AND is_pizza = 1")
    .all(ids)) as { id: number }[];
  return new Set(rows.map((r) => r.id));
}
