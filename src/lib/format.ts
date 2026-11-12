export function formatPrice(value: number): string {
  return `${value.toFixed(2)} €`;
}

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
