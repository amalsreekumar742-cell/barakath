import type { Timestamp } from 'firebase/firestore';

/**
 * Active order-list filters (spec §1.7). `status` is '' for the "All" tab (no status constraint).
 * Date bounds are Firestore Timestamps applied as a `createdAt` range.
 */
export interface OrderFilters {
  status: string;
  searchTerm: string;
  dateFrom: Timestamp | null;
  dateTo: Timestamp | null;
}

/** Per-status tab counts shown on the Orders page (spec §1.7). */
export interface OrderStatusCounts {
  all: number;
  pending: number;
  accepted: number;
  packed: number;
  shipped: number;
  outForDelivery: number;
  delivered: number;
  cancelled: number;
}
