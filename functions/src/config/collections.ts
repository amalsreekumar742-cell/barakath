/**
 * Collections — the single source of truth for Firestore collection names used by Cloud Functions.
 * Mirrors packages/shared/src/config/collections.ts (functions can't import the workspace package at
 * runtime, so the contract is duplicated here). Keep the two in lockstep.
 */
export const Collections = {
  users: 'users',
  products: 'products',
  variants: 'variants',
  categories: 'categories',
  orders: 'orders',
  payments: 'payments',
  walletTransactions: 'walletTransactions',
  /**
   * Pending/settled customer wallet top-ups. Server-written only. Exists so
   * verification can read the amount the Razorpay order was opened FOR, instead
   * of trusting an amount the client sends back after paying.
   */
  walletTopUps: 'walletTopUps',
  coupons: 'coupons',
  general: 'general',
  replacements: 'replacements',
  affiliateTransactions: 'affiliateTransactions',
  affiliateWithdrawals: 'affiliateWithdrawals',
  spinnerCampaigns: 'spinnerCampaigns',
  spinHistory: 'spinHistory',
  flashSales: 'flashSales',
  banners: 'banners',
  notifications: 'notifications',
  reviews: 'reviews',
  stockAdjustments: 'stockAdjustments',
  subAdmins: 'subAdmins',
  addresses: 'addresses',
} as const;
