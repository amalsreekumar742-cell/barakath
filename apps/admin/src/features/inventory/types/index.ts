import type { StockStatus } from '@barakath/shared/config/enums';
import type { Timestamp } from 'firebase/firestore';

/**
 * A single inventory row = ONE variant with its parent product's context (design §08 Inventory:
 * Product · SKU · Variant · In stock · Status · Updated). Rows are flattened from a paginated product
 * query + each product's variant subcollection, so the list stays variant-level while search and
 * pagination run server-side on the product documents.
 */
export interface InventoryRow {
  productId: string;
  productName: string;
  productSku: string;
  /** Variant-specific SKU: `${productSku}-${color}-${name}` (design "PERF-001-GR-M"). */
  sku: string;
  /** Color · Size label (design "Green · M"), or "—" when the variant has no color/name. */
  variantLabel: string;
  lowStockThreshold: number;
  variantId: string;
  variantName: string;
  variantColor: string;
  colorCode: string;
  stock: number;
  /** Derived from this variant's stock vs the product threshold. */
  status: StockStatus;
  /** Product's last-updated time (variants have no updatedAt) — powers the "Updated" column. */
  updatedAt: Timestamp | null;
}

/**
 * How the inventory list is ordered. The two stock orders rank by the VARIANT's own `stock` — the
 * number the table actually shows — which `fetchInventory` has to compute client-side over a bounded
 * scan; see the strategy note there for why Firestore cannot serve that ordering directly.
 */
export type InventorySort = 'newest' | 'stockAsc' | 'stockDesc';

/** Active inventory filter (spec §1.6). Search runs on the product keywords. */
export interface InventoryFilters {
  searchTerm?: string;
  /** Product-doc `categoryId`. Undefined = all categories. */
  categoryId?: string;
  /** Undefined is treated as 'newest' — the list's original order. */
  sort?: InventorySort;
}

/**
 * Summary-card counts (design §08): product counts by stock status (In stock / Low / Out) + the total
 * SKU (variant) count. In+Low+Out equals the product total; Total SKUs is the variant total.
 */
export interface InventoryCounts {
  inStock: number;
  lowStock: number;
  outOfStock: number;
  totalSkus: number;
}

/** One pending per-variant edit inside the Adjust Stock page (before the batch save). */
export interface StockEdit {
  productId: string;
  productName: string;
  productSku: string;
  variantId: string;
  variantName: string;
  variantLabel: string;
  lowStockThreshold: number;
  previousStock: number;
  newStock: number;
}
