/**
 * Coupon feature-local types (spec §1.12 / Feature 12). These stay inside the feature because they
 * describe list-filter and form-input shapes that only the coupons screens use — nothing shared across
 * apps (that contract is CouponProps in packages/shared).
 */

/** The status tab options on the Coupons list. Computed client-side from isActive + validUntil. */
export type CouponStatusFilter = 'All' | 'Active' | 'Expired' | 'Inactive';

/** Active list filters — drives the cursor-paginated query and resets the list when changed. */
export interface CouponFilters {
  status: CouponStatusFilter;
  searchTerm: string;
}

/**
 * CouponInput — the create/update payload produced by the form. Dates are plain JS `Date` here (from
 * the date picker); the api thunk converts them to Firestore `Timestamp` at the write edge. `usedCount`
 * is intentionally absent — it is a server-owned counter the admin form must never write.
 */
export interface CouponInput {
  code: string;
  description: string;
  discountType: 'Percentage' | 'Fixed';
  discountValue: number;
  minimumOrderAmount: number;
  maximumDiscount: number;
  usageLimit: number;
  perUserLimit: number;
  validFrom: Date;
  validUntil: Date;
  isActive: boolean;
  applicationType: 'All' | 'Category' | 'Product';
  applicableCategories: string[];
  applicableProducts: string[];
}
