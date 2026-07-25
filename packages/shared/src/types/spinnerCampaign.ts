import type { Timestamp } from 'firebase/firestore';

/**
 * Spinner Campaign domain types (spec Feature 13). Shared here (not per-app) because the SAME Firestore
 * documents are written by the admin panel and read by the customer app — defining the shape once means
 * the contract can never drift between the surfaces.
 *
 * Date/time fields use the Firestore `Timestamp` type (never a plain epoch `number`) so they sort and
 * range-query correctly server-side and preserve nanosecond precision.
 */

/**
 * SpinnerSlotProps — one wedge on the wheel. A slot is either a `Coupon` (grants a discount code on win)
 * or a `Better luck` no-win. `probability` is the slot's share of the 100% wheel; the admin form enforces
 * that every campaign's slot probabilities sum to exactly 100. `color` is the wedge fill (hex).
 */
export interface SpinnerSlotProps {
  id: string;
  label: string;
  type: 'Coupon' | 'Better luck';
  couponCode: string;
  couponId: string;
  discountType: 'Percentage' | 'Fixed';
  discountValue: number;
  minimumOrderAmount: number;
  maximumDiscount: number;
  probability: number;
  color: string;
}

/**
 * SpinnerCampaignProps — a spin-the-wheel promotion. `totalSpins`/`totalWins` are server-owned counters
 * bumped by the customer app when a user spins, so the admin form never writes them (seeded to 0 on
 * create). `keywords` powers the list search (array-contains). Active/Ended is derived from `isActive`
 * plus `endDate` vs. now.
 */
export interface SpinnerCampaignProps {
  id: string;
  name: string;
  description: string;
  slots: SpinnerSlotProps[];
  maxSpinsPerUser: number;
  spinCooldownHours: number;
  couponValidityDays: number;
  isActive: boolean;
  totalSpins: number;
  totalWins: number;
  startDate: Timestamp;
  endDate: Timestamp;
  createdBy: string;
  createdByName: string;
  keywords: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * SpinHistoryProps — one recorded spin. Written by the CUSTOMER app when a user spins (the admin panel
 * only reads it for the campaign's Spin History tab), so the admin never creates these documents.
 */
export interface SpinHistoryProps {
  id: string;
  campaignId: string;
  userId: string;
  userName: string;
  userPhone: string;
  slotLabel: string;
  resultType: 'Coupon' | 'Better luck';
  couponCode: string;
  couponId: string;
  createdAt: Timestamp;
}
