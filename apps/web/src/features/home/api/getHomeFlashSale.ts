import 'server-only';

import { getActiveFlashSale, getFlashSaleProducts, type ActiveFlashSale } from '@/lib/data/flashSales';
import { getFirstVariantByProduct } from '@/lib/data/catalog';
import type { FlashSaleItem } from '../types/flashSaleItem';

/** What the home page needs to render (or skip) the flash-sale rail. */
export interface HomeFlashSale {
  sale: ActiveFlashSale;
  items: FlashSaleItem[];
}

/**
 * The home page's flash-sale data, or null when no sale is currently live.
 *
 * WHY the product+variant pairing happens here and not in the component: a Server Component page
 * should hand its sections fully-resolved data (this feature's convention — see `getHeroSlides`), and
 * pairing "product flagged into the sale" with "the variant that actually carries the flash price" is
 * exactly the step `resolvePrice` depends on (spec §1.16 — offer price HIDDEN during a flash sale).
 *
 * WHY products with no variant are dropped rather than rendered at ₹0: `getFirstVariantByProduct`
 * only returns an entry for a product that actually has one (see catalog.ts's own warning about this
 * exact failure mode) — a product missing from the returned map has nothing to price and is filtered
 * out here rather than reaching `resolvePrice` with an undefined variant.
 */
export async function getHomeFlashSale(max: number = 8): Promise<HomeFlashSale | null> {
  const sale = await getActiveFlashSale();
  if (!sale) return null;

  const products = await getFlashSaleProducts(max);
  if (products.length === 0) return null;

  const variantByProduct = await getFirstVariantByProduct(products.map((p) => p.id));
  const items = products
    .map((product) => {
      const variant = variantByProduct[product.id];
      return variant ? { product, variant } : null;
    })
    .filter((item): item is FlashSaleItem => item !== null);

  if (items.length === 0) return null;
  return { sale, items };
}
