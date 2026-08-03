import type { Timestamp } from 'firebase/firestore';

/**
 * Cost-of-goods documents — the "purchase payment" side of the ledger, kept OUT of any document a
 * customer can read. See `FirestoreCollections.variantCosts` / `.orderCosts` for why these are
 * separate collections rather than fields on the variant and the order.
 *
 * Nothing here is ever sent to the app or the website. Both collections are admin-only in
 * `firestore.rules`; Cloud Functions write them through the Admin SDK.
 */

/** `variantCosts/{variantId}` — the current purchase price of one variant. */
export interface VariantCostProps {
  /** Mirrors the doc id. */
  variantId: string;
  /** The parent product, so costs can be cleaned up / listed per product. */
  productId: string;
  /** What the business pays per unit, in rupees. */
  purchasePrice: number;
  updatedAt: Timestamp;
}

/** One line of an order's cost snapshot. */
export interface OrderCostLine {
  productId: string;
  variantId: string;
  quantity: number;
  /** Purchase price per unit AT THE TIME OF SALE — never re-read from `variantCosts` later. */
  purchasePrice: number;
  /** What the customer paid per unit for the same line, so margin is self-contained. */
  sellingPrice: number;
  /** `purchasePrice × quantity`. */
  lineCost: number;
}

/**
 * `orderCosts/{orderId}` — cost of goods for one order.
 *
 * `costKnown` is false when ANY line had no recorded purchase price. Profit for such an order is
 * unknowable, not zero, and the report must exclude it rather than report the whole sale as margin.
 */
export interface OrderCostProps {
  orderId: string;
  lines: OrderCostLine[];
  /** Σ `lineCost` across lines with a known cost. */
  totalCost: number;
  /** Σ `sellingPrice × quantity` across the SAME lines, so profit = revenue − cost is like-for-like. */
  totalSelling: number;
  costKnown: boolean;
  createdAt: Timestamp;
}
