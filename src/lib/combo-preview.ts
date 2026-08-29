import type { ProductWithOptions } from "@/lib/types";

// One line of a combo's bill of materials, as edited in an admin form —
// size_id is null until the chosen product has more than one size, at
// which point it must point at one of that product's own product_sizes.
export type ComboItemRow = { product_id: number; size_id: number | null; quantity: number };

// Sums each combo line's (component's own base price + chosen size's
// delta) × quantity, from the *currently loaded* product list — this is
// only ever a live preview for the admin; the server always recomputes the
// real, authoritative total from the database on save (see
// computeComboPrice in src/lib/repos/products.ts).
export function comboSum(items: ComboItemRow[], allProducts: ProductWithOptions[]): number {
  let sum = 0;
  for (const item of items) {
    const product = allProducts.find((p) => p.id === item.product_id);
    if (!product) continue;
    const size = item.size_id ? product.sizes.find((s) => s.id === item.size_id) : undefined;
    sum += (product.base_price + (size?.price_delta ?? 0)) * item.quantity;
  }
  return sum;
}
