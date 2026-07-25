import { StockStatus } from '@barakath/shared/config/enums';

/**
 * Stock derivation from variants (spec §1.5 / §1.6 auto-calc).
 * WHY derive centrally: `totalStock` and `stockStatus` are computed the same way on create and update,
 * so the rule ("0 → Out of stock, ≤ threshold → Low stock, else In stock") lives in one place.
 */
export function sumStock(stocks: number[]): number {
  return stocks.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
}

export function deriveStockStatus(totalStock: number, lowStockThreshold: number): StockStatus {
  if (totalStock <= 0) return StockStatus.OUT_OF_STOCK;
  if (totalStock <= lowStockThreshold) return StockStatus.LOW_STOCK;
  return StockStatus.IN_STOCK;
}

/**
 * Denormalized list fields (spec §1.5 list): thumbnail = first PRODUCT image; min/max = variant
 * offer-price range. Kept on the product doc so the listing renders from one read.
 */
export function deriveListFields(
  images: string[],
  variants: { offerPrice: number }[],
): { thumbnail: string; minPrice: number; maxPrice: number } {
  const prices = variants.map((v) => v.offerPrice).filter((n) => Number.isFinite(n));
  return {
    thumbnail: images[0] ?? '',
    minPrice: prices.length ? Math.min(...prices) : 0,
    maxPrice: prices.length ? Math.max(...prices) : 0,
  };
}
