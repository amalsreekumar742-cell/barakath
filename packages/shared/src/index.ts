/**
 * @barakath/shared — barrel export for the framework-agnostic shared library.
 *
 * NOTE: apps are encouraged to import from the specific subpath (e.g. '@barakath/shared/config/collections')
 * for better tree-shaking, but this barrel is provided for convenience and package-level consumers.
 */
export { FirestoreCollections, FirestoreDocs } from './config/collections';
export type { FirestoreCollectionName } from './config/collections';
export * from './config/enums';
export {
  ORDER_PAYMENT_TIMEOUT_MINUTES,
  ORDER_PAYMENT_TIMEOUT_MS,
  msUntilOrderExpiry,
} from './config/orderTimeout';
export * from './types';
export { default as keywordsBuilder } from './utils/keywordsBuilder';
export {
  computeReplacementRefund,
  ReplacementLineNotFoundError,
} from './utils/replacementRefund';
export type {
  ReplacementRefundInput,
  ReplacementRefundBreakdown,
} from './utils/replacementRefund';
export { gstBreakdown, hasLineGst, isGstInclusive, gstPresentation } from './utils/gstBreakdown';
export type { GstBreakdownRow } from './utils/gstBreakdown';
export {
  DEFAULT_SPIN_VALIDITY_HOURS,
  resolveValidityHours,
  formatValidityWindow,
  formatTimeRemaining,
} from './utils/spinValidity';

// Placeholder for shared brand assets (used by BOTH web apps) — one canonical file each.
// e.g. export { default as logo } from './assets/logo.webp';
