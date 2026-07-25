import type { Timestamp } from 'firebase/firestore';

/**
 * Payments feature types (spec §1.9). `status` / `method` are '' for the "All" pills (no constraint);
 * otherwise a PaymentStatus / PaymentMethod value. `searchTerm` matches an order-id prefix. Date bounds
 * apply a `createdAt` range.
 */
export interface PaymentFilters {
  status: string;
  method: string;
  searchTerm: string;
  dateFrom: Timestamp | null;
  dateTo: Timestamp | null;
}

/** Header-line figures for the Payments page (design: "₹X this month · N failed", not a stat-card grid). */
export interface PaymentStats {
  totalRevenue: number;
  /** `Paid` revenue since the start of the current calendar month — backs the header subtitle. */
  monthRevenue: number;
  totalRefunds: number;
  razorpayCount: number;
  walletCount: number;
  bothCount: number;
  failedCount: number;
}
