import type { Timestamp } from 'firebase/firestore';
import type { ProductStatus, StockStatus } from '../config/enums';

/**
 * VariantProps / SpecificationProps / ProductProps — catalogue product model (spec §1.5, §1.6).
 *
 * WHY here: shared across admin (CRUD), storefront (display) and Cloud Functions. Each variant carries
 * its own Price/Offer/stock (per-variant pricing, spec §1.5). `stockStatus`/`totalStock` are derived
 * server-side from variants (spec §1.6 auto-calc). Date fields use `Timestamp`.
 */
/**
 * One axis value of a variant — a unit from a Settings › Variables group, e.g. `{ group: 'Size', value: '57' }`
 * or `{ group: 'Layer', value: '2' }`. The group name travels WITH the variant so storefronts can label the
 * chip row without reading `variables/config` (admin-only).
 */
export interface VariantOption {
  group: string;
  value: string;
}

export interface VariantProps {
  id: string;
  /**
   * Display label of the non-colour part of the variant. For a single-axis variant it IS the axis value
   * (e.g. "57", shown under "Size"). For a multi-axis variant it is DERIVED from `options` by
   * `variantLabel` (e.g. "57 · Layer 2") and written alongside them, so every surface that only prints
   * `name` — cart, order snapshot, invoice, inventory, reviews — keeps working unchanged.
   */
  name: string;
  /**
   * One unit per Settings › Variables group, in group order — e.g. Size 57 + Layer 2. ABSENT on
   * single-axis variants (every variant before multi-axis support): their `name` is the only axis.
   * An array, not a map, so the axis order (Size before Layer) survives Firestore. Read it through
   * `variantAxes` (utils/variantOptions), which folds the legacy case in.
   */
  options?: VariantOption[];
  color: string;
  colorCode: string;
  /**
   * The product-gallery photo that shows this variant — one of `ProductProps.images`, picked in the admin
   * variant table. Picking a colour on the storefront slides the gallery to it. ABSENT when none was
   * picked; a url no longer in `images` (photo removed) counts as absent. Read it through
   * `variantImageIndex` (utils/variantImage), which also falls back to another size of the same colour,
   * so the admin only has to set it once per colour.
   */
  imageUrl?: string;
  /** Per-variant pricing (spec §1.5): MRP ≥ Offer ≥ Referral ≥ Commission. */
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
  /**
   * Display position within the product, 0-based — set by the admin's ▲/▼ variant reorder. Variant 0
   * is the product's default / "first" variant on every surface (card price, PDP pre-selection).
   *
   * ABSENT on variants written before reordering existed. Readers must never drop such a variant:
   * sort with `sortVariants` (missing → after the ordered ones, `createdAt` order kept), and a
   * `orderBy('sortOrder')` query needs a `createdAt` fallback because Firestore silently excludes
   * documents lacking the orderBy field.
   */
  sortOrder?: number;
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
