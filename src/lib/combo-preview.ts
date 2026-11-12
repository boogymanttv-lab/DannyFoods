import type { ProductWithOptions } from "@/lib/types";

export type ComboItemRow = { product_id: number; size_id: number | null; quantity: number };

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
