import type { StockStatus } from '@barakath/shared/config/enums';
import type { VariantOption } from '@barakath/shared/types';

/**
 * Active list filters (spec §1.5 Filters Panel). All optional; an unset filter is not applied.
 * WHY category is a single id here (not multi): a Firestore `where('categoryId','==',x)` needs one
 * value, and the sub-category filter only makes sense for a single selected category (spec §1.5).
 */
export interface ProductFilters {
  categoryId?: string;
  subCategoryId?: string;
  stockStatus?: StockStatus;
  productStatus?: 'Active' | 'Archived';
  priceMin?: number;
  priceMax?: number;
  searchTerm?: string;
}

/**
 * A local, ordered product image. Either an already-uploaded `url` (edit mode) or a freshly cropped
 * `blob` to upload on save. `id` is a local key for React lists + drag reorder (first = hero).
 */
export interface ImageDraft {
  id: string;
  url?: string;
  blob?: Blob;
}

/**
 * A variant being edited in the product form BEFORE the product is saved (spec §1.5). Nothing is
 * written to Firestore until the whole product is saved; `isNew` distinguishes create-vs-update and a
 * real Firestore id (edit) from a temp uuid (add). Images live on the PRODUCT (right-side gallery),
 * not the variant (spec §1.5 / design).
 */
export interface VariantDraft {
  id: string;
  isNew: boolean;
  /**
   * Display label of the non-colour part. For a new row it is `variantLabel(options)` ("57 · Layer 2");
   * an existing row keeps the name it was saved with.
   */
  name: string;
  /**
   * One unit per Settings › Variables group, in group order — see `VariantProps.options`. Set on every
   * row added from the picker (even a Size-only one); absent on legacy variants loaded without it, which
   * the save then leaves without it.
   */
  options?: VariantOption[];
  color: string;
  colorCode: string;
  /**
   * Purchase payment — what the business pays per unit. Persisted to `variantCosts/{variantId}`, NOT
   * to the variant document, because variants are world-readable and this is the margin. See
   * `FirestoreCollections.variantCosts`.
   */
  purchasePrice: number;
  mrp: number;
  offerPrice: number;
  referralPrice: number;
  commission: number;
  /**
   * GST rate for this variant as a percentage (18 = 18%). `null` means "use the shop default" — the
   * state a variant authored before per-variant rates is loaded in, since those were taxed at the
   * global Settings › Delivery & Tax rate. The form resolves null against that rate on submit, so a
   * concrete number always reaches Firestore; defaulting it to 0 instead would silently un-tax every
   * legacy variant the moment its product was edited.
   */
  gstPercentage: number | null;
  stock: number;
  /**
   * The stock as LOADED, for existing variants only (absent on new ones). The save writes `stock` only
   * when it differs from this, so orders placed while the form was open are not overwritten by the
   * form's stale copy — see `planVariantStock`.
   */
  originalStock?: number;
}

/**
 * A variant on its way to Firestore. Identical to [VariantDraft] except that "inherit the shop
 * default" has already been resolved, so the write path can never persist an ambiguous rate. Array
 * order is the saved display order (`VariantProps.sortOrder` = index).
 */
export type VariantToSave = Omit<VariantDraft, 'gstPercentage'> & { gstPercentage: number };

/** A frequently-bought-together pick shown as a removable card (spec §1.5). */
export interface FBTItem {
  id: string;
  name: string;
  image: string;
}
