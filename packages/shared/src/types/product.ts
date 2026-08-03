import type { Timestamp } from 'firebase/firestore';
import type { ProductStatus, StockStatus } from '../config/enums';

/**
 * VariantProps / SpecificationProps / ProductProps — catalogue product model (spec §1.5, §1.6).
 *
 * WHY here: shared across admin (CRUD), storefront (display) and Cloud Functions. Each variant carries
 * its own Price/Offer/stock (per-variant pricing, spec §1.5). `stockStatus`/`totalStock` are derived
 * server-side from variants (spec §1.6 auto-calc). Date fields use `Timestamp`.
 */
export interface VariantProps {
  id: string;
  name: string;
  color: string;
  colorCode: string;
  /** Per-variant pricing (spec §1.5): MRP ≥ Offer ≥ Referral ≥ Commission. Images live on the product. */
  mrp: number;
  offerPrice: number;
  referralPrice: number;
  commission: number;
  /**
   * GST rate charged on this variant, as a percentage (18 = 18%).
   *
   * WHY per variant rather than the single `general/config` rate: rates differ by goods, and the tax
   * invoice has to state the rate actually applied. ABSENT on every variant authored before this
   * field existed — checkout falls back to the global `gstPercentage` for those, so read it as
   * `typeof v.gstPercentage === 'number' ? … : globalRate` and never as `v.gstPercentage ?? 0`
   * (a genuine 0% variant and an unset one are different things).
   */
  gstPercentage?: number;
  stock: number;
  /**
   * The variant's price WHILE a flash sale is live. Written by the `flashSaleManager` scheduler when a
   * sale's window opens (snapshotted from the sale's per-variant price), and DELETED when it closes —
   * so it is present only for variants of a product whose `ProductProps.isFlashSale` is true, and
   * absent otherwise. Storefront pricing reads it via `resolvePrice`: never read it without first
   * checking `isFlashSale`, and never treat its absence as ₹0.
   */
  flashSalePrice?: number;
  createdAt: Timestamp;
}

export interface SpecificationProps {
  key: string;
  value: string;
}

export interface ProductProps {
  id: string;
  name: string;
  sku: string;
  description: string;
  categoryId: string;
  categoryName: string;
  subCategoryId: string;
  subCategoryName: string;
  /** Product image gallery (spec §1.5 Images section, right side): first = hero, max 5. */
  images: string[];
  specifications: SpecificationProps[];
  youtubeVideoLink: string;
  isCombo: boolean;
  comboDeliveryCharge: number;
  replacementAvailable: boolean;
  lowStockThreshold: number;
  frequentlyBoughtTogether: string[];
  status: ProductStatus;
  stockStatus: StockStatus;
  totalStock: number;
  /**
   * Denormalized fields for efficient list/grid rendering (spec §1.5 list). Maintained server-side on
   * every product write so the listing is a single paginated read: `thumbnail` = first product image;
   * `minPrice`/`maxPrice` = variant offer-price range.
   */
  thumbnail: string;
  minPrice: number;
  maxPrice: number;
  isNewArrival: boolean;
  isFlashSale: boolean;
  /**
   * Denormalised review roll-up, recomputed by the `onReviewCreate` trigger
   * (`functions/src/triggers/service/recomputeProductRating.ts`) from the PUBLISHED reviews only.
   *
   * WHY on the product rather than counted at read time: a catalogue grid shows a rating on every
   * card, and querying reviews per card would be one aggregation per product on every page render.
   *
   * `averageRating` is 0 when there are no reviews yet — 0 means "unrated", not "rated zero", so
   * render the stars off `totalReviews > 0`, never off the average.
   */
  averageRating: number;
  totalReviews: number;
  keywords: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
