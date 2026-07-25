import type { ProductProps, VariantProps } from '@barakath/shared';

/**
 * FlashSaleItem — a flash-sale product paired with the variant its card prices off of.
 *
 * WHY both are needed together: `resolvePrice(product, variant)` (the single pricing truth, see
 * `@/lib/pricing`) requires both — the flash flag lives on the product, the flash price on the
 * variant. A product that made it into `getFlashSaleProducts` but has no variant (edge case: zero
 * variants) is filtered out before this type is ever constructed, so a `FlashSaleItem` always has a
 * priceable pair.
 */
export interface FlashSaleItem {
  product: ProductProps;
  variant: VariantProps;
}
