import type { Timestamp } from 'firebase/firestore';

/**
 * StockAdjustmentProps — one audit-log entry for a manual stock change (spec §1.6 Adjust Stock,
 * §1.22 "stock adjust" is a confirmed action). Every change to a variant's stock writes one of these
 * to the `stockAdjustments` collection so inventory movements are traceable to an admin + a reason.
 *
 * WHY here (not per-app): the admin writes these and a future report/Cloud Function reads them; one
 * definition keeps the shape identical. Date fields use `Timestamp` (not epoch millis).
 */
export interface StockAdjustmentProps {
  id: string;
  productId: string;
  productName: string;
  variantId: string;
  variantName: string;
  /** Stock before the adjustment. */
  previousStock: number;
  /** Stock after the adjustment. */
  newStock: number;
  /** newStock − previousStock (signed). */
  adjustment: number;
  /** Required reason for the adjustment (spec §1.6). */
  reason: string;
  /** Optional reference / note (spec §1.6 Adjust Stock right panel). */
  note: string;
  /** Admin who made the change. */
  adjustedBy: string;
  adjustedByName: string;
  createdAt: Timestamp;
}
