/**
 * AffiliateProductCommission — one editable per-variant commission row on the admin Affiliate →
 * Commissions tab (spec §1.14 "Commission = fixed ₹ per variant (from product variant table)").
 *
 * WHY here (not per-app): the admin panel edits these amounts and both the customer app (to award the
 * affiliate on a referred sale) and Cloud Functions (to clear the reward) read the same per-variant
 * value written to `products/{productId}/variants/{variantId}`. Defining the shape once keeps the
 * edit-and-award contract identical across surfaces. `commission` is the fixed ₹ amount an affiliate
 * earns per referred sale of this variant; `productName`/`variantName` are carried for display only so
 * the admin table needs no extra lookups when saving.
 *
 * NOTE on the underlying field: the value is persisted to the variant doc's existing `commission`
 * field (see `VariantProps.commission`, spec §1.5 "Fixed ₹, must be < Referral price") — the affiliate
 * commission per variant IS that field. No new variant field is introduced.
 */
export interface AffiliateProductCommission {
  productId: string;
  productName: string;
  variantId: string;
  variantName: string;
  commission: number;
}
