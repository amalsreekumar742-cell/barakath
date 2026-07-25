import type { Timestamp } from 'firebase/firestore';

/**
 * Flash-sale campaign model (spec §1.16).
 *
 * WHY here (not per-app): the flash sale doc is read by admin (CRUD), the storefront (countdown +
 * flash pricing on product cards) and the Cloud Scheduler function that activates/deactivates a sale
 * at its window edges. Defining the shape once means it can never drift between surfaces.
 *
 * A flash sale applies ONE discount (a percentage off, or a fixed flat price) to a SET of products for a
 * fixed window. `discountType` + `discountValue` are the admin's single input; the per-variant discounted
 * prices are snapshotted into each product's `variantPrices` at creation. During the window each product
 * doc carries `isFlashSale: true` and each variant carries `flashSalePrice`; both revert when the sale
 * ends or is toggled off. `productIds` denormalises the product ids for an array-contains "already in a
 * sale?" lookup. Date fields use `Timestamp`.
 */
export interface FlashSaleVariantPrice {
  variantId: string;
  variantName: string;
  originalMrp: number;
  originalOfferPrice: number;
  flashSalePrice: number;
}

/** One product in a flash sale, with the per-variant price snapshot the discount produced. */
export interface FlashSaleProduct {
  productId: string;
  productName: string;
  productImage: string;
  categoryName: string;
  variantPrices: FlashSaleVariantPrice[];
}

export interface FlashSaleProps {
  id: string;
  name: string;
  description: string;
  /** How the discount is expressed: a percentage off the offer price, or a fixed flat sale price. */
  discountType: 'Percentage' | 'Fixed';
  /** The percentage (1–99) or the flat price (₹), per `discountType`. */
  discountValue: number;
  products: FlashSaleProduct[];
  /** Denormalised product ids for the "already in an active sale?" array-contains lookup. */
  productIds: string[];
  startDate: Timestamp;
  endDate: Timestamp;
  /** Admin toggle: the sale is enabled. A sale is only LIVE when this is true AND `activated` is true. */
  isActive: boolean;
  /**
   * Server-managed "the price changes are currently applied" flag, owned by the `flashSaleManager`
   * scheduler (`functions/src/utility/flashSaleManager.ts`). Set true when the scheduler enters the
   * window and writes `isFlashSale`/`flashSalePrice` across the sale's products/variants; set false
   * when it reverts them. Optional because an older doc created before the flag existed may lack it —
   * treat a missing value as false (not yet applied). The storefront must gate a live sale on
   * `isActive && activated && startDate <= now < endDate`, never on `isActive` alone.
   */
  activated?: boolean;
  createdBy: string;
  createdByName: string;
  keywords: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
