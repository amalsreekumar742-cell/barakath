import type { StockStatus } from '@barakath/shared/config/enums';

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
  name: string;
  color: string;
  colorCode: string;
  mrp: number;
  offerPrice: number;
  referralPrice: number;
  commission: number;
  stock: number;
}

/** A frequently-bought-together pick shown as a removable card (spec §1.5). */
export interface FBTItem {
  id: string;
  name: string;
  image: string;
}
