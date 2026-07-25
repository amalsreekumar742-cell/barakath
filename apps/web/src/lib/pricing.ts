import type { ProductProps, VariantProps } from '@barakath/shared';

/**
 * pricing — the SINGLE pricing truth for the storefront. PURE: no Firestore, no I/O, no `Timestamp`
 * math, no formatting. Every Batch 2 surface (cards, listing, PDP, cart preview) imports `resolvePrice`
 * so a product's displayed price is derived one way in exactly one place.
 *
 * WHY a resolver rather than reading fields directly at each call site: a variant carries THREE prices
 * (`mrp`, `offerPrice`, `flashSalePrice?`) and which one the customer pays depends on whether a flash
 * sale is live on the product. Spreading that `if` across every component is how one screen ends up
 * charging the offer price during a flash sale while another charges the flash price. Deciding it once
 * here makes the rule unforgeable.
 *
 * WHY it takes a `product` AND a `variant`: the flash flag lives on the PRODUCT (`isFlashSale`) but the
 * price lives on the VARIANT (`flashSalePrice`/`offerPrice`/`mrp`). Neither alone can resolve a price,
 * and the two must be checked together — the flash price is present on a variant ONLY while the sale is
 * live, and reading it without confirming `product.isFlashSale` risks showing a stale/absent value.
 *
 * WHY this does NOT touch W4's `PriceBlock`: `PriceBlock` renders a min–max RANGE from the denormalised
 * `ProductProps` (which has no MRP) and is intentionally left read-only. A card that only has the
 * product renders the range via `PriceBlock`; a surface that has resolved to ONE variant (PDP, cart,
 * a single-price card) calls `resolvePrice` to get the exact figure, MRP and discount for that variant.
 */

/** The one resolved price a surface renders for a specific product+variant. */
export interface ResolvedPrice {
  /** What the customer pays for this variant right now (₹). */
  displayPrice: number;
  /** The struck-through comparison price (the variant MRP). */
  mrp: number;
  /** Whole-percent saving of `mrp` over `displayPrice`; 0 when there is no genuine discount. */
  discountPercent: number;
  /** True when the price is a live flash-sale price (the offer price is HIDDEN, spec §1.16). */
  isFlash: boolean;
}

/**
 * Whole-percent saving of `mrp` over `price`, or 0 when there is nothing to state.
 * WHY rounded and floored-to-zero: 27.6% reads "28% off" like the design, and a non-saving
 * (`mrp <= price`, or a missing/zero MRP) shows no badge rather than "0% off" or a negative number.
 */
function percentOff(mrp: number, price: number): number {
  if (mrp <= 0 || price <= 0 || mrp <= price) return 0;
  return Math.round(((mrp - price) / mrp) * 100);
}

/**
 * Resolve the price a surface should show for one product+variant.
 *
 * WHY the flash branch requires BOTH `product.isFlashSale` and a non-null `variant.flashSalePrice`:
 * the scheduler writes `flashSalePrice` onto a variant while the sale is live and DELETES it when the
 * sale ends, so its absence is "no flash price", never ₹0. Checking the product flag first means a
 * stale field can never be mistaken for a live sale. During a flash sale the offer price is HIDDEN
 * (spec §1.16) — the comparison shown is against the MRP, so the saving is `mrp` vs the flash price.
 *
 * WHY the non-flash branch compares `mrp` to `offerPrice` (not `minPrice`): this resolver has a real
 * variant, so it states the exact per-variant saving; the range-based `discountPercent` in `PriceBlock`
 * is for the card that only holds the denormalised product.
 */
export function resolvePrice(
  product: Pick<ProductProps, 'isFlashSale'>,
  variant: Pick<VariantProps, 'flashSalePrice' | 'mrp' | 'offerPrice'>,
): ResolvedPrice {
  if (product.isFlashSale && variant.flashSalePrice != null) {
    const displayPrice = variant.flashSalePrice;
    return {
      displayPrice,
      mrp: variant.mrp,
      discountPercent: percentOff(variant.mrp, displayPrice),
      isFlash: true,
    };
  }

  const displayPrice = variant.offerPrice;
  return {
    displayPrice,
    mrp: variant.mrp,
    discountPercent: percentOff(variant.mrp, displayPrice),
    isFlash: false,
  };
}
