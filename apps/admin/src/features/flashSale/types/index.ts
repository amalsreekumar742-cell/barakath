/**
 * Flash Sale feature-local types (spec §1.16 / Feature 16). These stay inside the feature because they
 * describe list-filter and form-input shapes only the flash-sale screens use — the shared contract is
 * FlashSaleProps in packages/shared.
 */

/** Active list filters — drives the cursor-paginated query and resets the list when changed. */
export interface FlashSaleFilters {
  searchTerm: string;
}

/** A concrete flash-sale status label derived for one sale (drives the On/off state + window label). */
export type FlashSaleStatus = 'Active' | 'Scheduled' | 'Ended';

/**
 * FlashSalePriceInput — one variant's flash price computed by the create form from the sale's discount.
 * Original MRP/offer are carried through so the api can snapshot them into the doc without a second read.
 */
export interface FlashSalePriceInput {
  variantId: string;
  variantName: string;
  originalMrp: number;
  originalOfferPrice: number;
  flashSalePrice: number;
}

/** One product in the create payload, with its computed per-variant flash prices. */
export interface FlashSaleProductInput {
  productId: string;
  productName: string;
  productImage: string;
  categoryName: string;
  variantPrices: FlashSalePriceInput[];
}

/**
 * FlashSaleInput — the create payload produced by the form. A single discount (type + value) is applied to
 * every selected product; the form snapshots the resulting per-variant prices into `products`. Dates are
 * plain JS `Date` here (from the date picker); the api thunk converts them to Firestore `Timestamp`.
 */
export interface FlashSaleInput {
  name: string;
  description: string;
  discountType: 'Percentage' | 'Fixed';
  discountValue: number;
  products: FlashSaleProductInput[];
  startDate: Date;
  endDate: Date;
  isActive: boolean;
}
