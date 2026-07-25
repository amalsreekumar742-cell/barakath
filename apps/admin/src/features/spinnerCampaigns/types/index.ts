/**
 * Spinner-campaign feature-local types (spec Feature 13). These stay inside the feature because they
 * describe list-filter and form-input shapes only the spinner-campaign screens use — the cross-app
 * contract is SpinnerCampaignProps/SpinnerSlotProps/SpinHistoryProps in packages/shared.
 */

/**
 * The status pill options on the Campaigns list. Computed from isActive + endDate:
 * Active = isActive && endDate>now, Ended = isActive && endDate<=now, Inactive = !isActive.
 */
export type CampaignStatusFilter = 'All' | 'Active' | 'Ended' | 'Inactive';

/** Active list filters — drives the cursor-paginated query and resets the list when changed. */
export interface CampaignFilters {
  status: CampaignStatusFilter;
  searchTerm: string;
}

/**
 * SlotInput — one slot row as edited in the form (before it becomes a persisted SpinnerSlotProps).
 * Identical field shape to SpinnerSlotProps; kept separate so the form can carry a draft `id` and we
 * convert to the stored type at the write edge.
 */
export interface SlotInput {
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
 * CampaignInput — the create/update payload produced by the form. Dates are plain JS `Date` here (from
 * the date picker); the api thunk converts them to Firestore `Timestamp` at the write edge. Server-owned
 * counters (totalSpins/totalWins) are intentionally absent — the admin form must never write them.
 */
export interface CampaignInput {
  name: string;
  description: string;
  slots: SlotInput[];
  maxSpinsPerUser: number;
  spinCooldownHours: number;
  couponValidityDays: number;
  isActive: boolean;
  startDate: Date;
  endDate: Date;
}
