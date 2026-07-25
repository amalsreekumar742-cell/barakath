import type { ProductProps, VariantProps } from '@barakath/shared/types';

/**
 * Affiliate feature types (spec §1.14). The page has three top-level tabs (Affiliates / Withdrawals /
 * Commissions); the Withdrawals tab additionally filters by status. Kept in the feature (not shared)
 * because they only describe this screen's local view state, not a Firestore contract.
 */

/** Which top-level tab of the Affiliate page is active. */
export type AffiliateMainTab = 'affiliates' | 'withdrawals' | 'commissions';

/** The four summary figures shown as cards at the top of the Affiliate page (spec §1.14 listing). */
export interface AffiliateStats {
  /** Users with a non-empty `affiliateCode` (getCountFromServer). */
  totalAffiliates: number;
  /** Sum of all cleared referral commission credits ever paid to affiliates (₹). */
  totalCommissionPaid: number;
  /** Count of withdrawal requests awaiting admin action. */
  pendingWithdrawals: number;
  /** Sum of amounts (₹) across those pending withdrawal requests. */
  pendingAmount: number;
}

/** Per-status counts for the Withdrawals tab's status filter pills. */
export interface WithdrawalStatusCounts {
  all: number;
  pending: number;
  approved: number;
  rejected: number;
}

/**
 * A product plus its variant subcollection, for the Commissions tab's expandable rows. WHY carry the
 * variants inline: each variant's commission is edited in place, so the row needs the full variant list
 * loaded alongside the product (one paginated product read + one variants read per product).
 */
export type ProductWithVariants = ProductProps & { variants: VariantProps[] };
