export function formatPrice(value: number): string {
  return `${value.toFixed(2)} €`;
}

// The price to show on a product card/listing. For a product with sizes
// (e.g. a pizza priced only per size — base_price left at 0, "Малка"/
// "Голяма" each carrying their own price_delta), this is the default (or
// cheapest) size's total price, not the raw base_price — showing a bare
// "0.00 €" for a size-only product would be confusing. `fromMultiple` is
// true when there's more than one size, so the caller can prefix "от "
// ("from") to signal it's a starting price.
export function getDisplayPrice(product: {
  base_price: number;
  sizes: { price_delta: number; is_default: number }[];
}): { price: number; fromMultiple: boolean } {
  if (product.sizes.length === 0) {
    return { price: product.base_price, fromMultiple: false };
  }
  const defaultSize =
    product.sizes.find((s) => s.is_default) ??
    [...product.sizes].sort((a, b) => a.price_delta - b.price_delta)[0];
  return {
    price: product.base_price + defaultSize.price_delta,
    fromMultiple: product.sizes.length > 1,
  };
}
