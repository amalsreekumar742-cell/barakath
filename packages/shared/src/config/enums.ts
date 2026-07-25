/**
 * Domain enums shared across all apps — order statuses, product statuses, admin roles, etc.
 *
 * WHY here (not per-app): both TS/React apps and the Cloud Functions must agree on the exact string
 * values written to Firestore. Defining each enum once keeps the data contract identical everywhere.
 * WHY `as const` objects (not TS `enum`): the values are plain strings that serialize cleanly to
 * Firestore, and consumers get exact literal types + a matching union type.
 */

// --- Sub Admin (spec §1.1, §1.20) -------------------------------------------------

export const SubAdminRole = {
  SUPER_ADMIN: 'Super admin',
  MANAGER: 'Manager',
  SUPPORT: 'Support',
} as const;
export type SubAdminRole = (typeof SubAdminRole)[keyof typeof SubAdminRole];

export const SubAdminStatus = {
  ACTIVE: 'Active',
  SUSPENDED: 'Suspended',
} as const;
export type SubAdminStatus = (typeof SubAdminStatus)[keyof typeof SubAdminStatus];

/**
 * AdminModule — the canonical permission keys, one per sidebar module (spec §1.2, §1.20).
 *
 * WHY centralize: `SubAdminProps.permissions` is keyed by these strings, the sidebar reads them to
 * hide modules an admin lacks, and the Cloud Function seeds role-based defaults from them. One source
 * of truth prevents a permission key drifting between the creator, the storage, and the reader.
 */
// --- Orders (spec §1.3, §1.7) -----------------------------------------------------

export const OrderStatus = {
  PENDING: 'Pending',
  ACCEPTED: 'Accepted',
  PACKED: 'Packed',
  SHIPPED: 'Shipped',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export const PaymentMethod = {
  RAZORPAY: 'Razorpay',
  WALLET: 'Wallet',
  BOTH: 'Both',
} as const;
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

export const PaymentStatus = {
  PENDING: 'Pending',
  PAID: 'Paid',
  FAILED: 'Failed',
  REFUNDED: 'Refunded',
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

// --- Products / Inventory (spec §1.5, §1.6) ---------------------------------------

export const ProductStatus = {
  ACTIVE: 'Active',
  ARCHIVED: 'Archived',
} as const;
export type ProductStatus = (typeof ProductStatus)[keyof typeof ProductStatus];

export const StockStatus = {
  IN_STOCK: 'In stock',
  LOW_STOCK: 'Low stock',
  OUT_OF_STOCK: 'Out of stock',
} as const;
export type StockStatus = (typeof StockStatus)[keyof typeof StockStatus];

// --- Customers & wallet (spec §1.8) -----------------------------------------------

export const UserStatus = {
  ACTIVE: 'Active',
  BLOCKED: 'Blocked',
} as const;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

export const WalletTransactionType = {
  CREDIT: 'Credit',
  DEBIT: 'Debit',
} as const;
export type WalletTransactionType = (typeof WalletTransactionType)[keyof typeof WalletTransactionType];

/**
 * `walletTransactions.source` — the exact strings the Cloud Functions write.
 *
 * These are WIRE VALUES, not labels: every client matches on them, so a value that
 * nothing writes is dead and a value that is written but missing here is invisible.
 *   REFUND   ← cancelOrder / processRefund / dailyCleanup
 *   REWARD   ← store rewards
 *   PURCHASE ← debitWallet at checkout
 *   ADMIN    ← addWalletMoney ("Add money" in the admin panel)
 *   UPI_TOP_UP ← verifyWalletTopUp
 *
 * TOP_UP is legacy: nothing has ever written 'Top-up'. `verifyWalletTopUp` writes
 * 'UPI top-up', which is what the live ledger contains, so UPI_TOP_UP is the one to
 * match against. TOP_UP is kept only so an older document (if one exists) still maps.
 */
export const WalletSource = {
  REFUND: 'Refund',
  REWARD: 'Reward',
  /** @deprecated Never written. Use {@link WalletSource.UPI_TOP_UP}. */
  TOP_UP: 'Top-up',
  UPI_TOP_UP: 'UPI top-up',
  PURCHASE: 'Purchase',
  ADMIN: 'Admin',
} as const;
export type WalletSource = (typeof WalletSource)[keyof typeof WalletSource];

// --- Replacement (spec §1.10) -----------------------------------------------------

export const ReplacementStatus = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
} as const;
export type ReplacementStatus = (typeof ReplacementStatus)[keyof typeof ReplacementStatus];

// --- Reviews (spec §1.11) ---------------------------------------------------------

export const ReviewFilter = {
  ALL: 'All',
  PUBLISHED: 'Published',
  HIDDEN: 'Hidden',
} as const;
export type ReviewFilter = (typeof ReviewFilter)[keyof typeof ReviewFilter];

// --- Coupons (spec §1.12) ---------------------------------------------------------

export const DiscountType = {
  PERCENTAGE: 'Percentage',
  FIXED: 'Fixed',
} as const;
export type DiscountType = (typeof DiscountType)[keyof typeof DiscountType];

export const CouponApplicationType = {
  ALL: 'All',
  CATEGORY: 'Category',
  PRODUCT: 'Product',
} as const;
export type CouponApplicationType = (typeof CouponApplicationType)[keyof typeof CouponApplicationType];

// --- Banners (spec §1.15) ---------------------------------------------------------

export const BannerLinkType = {
  PRODUCT: 'Product',
  CATEGORY: 'Category',
  EXTERNAL: 'External',
  NONE: 'None',
} as const;
export type BannerLinkType = (typeof BannerLinkType)[keyof typeof BannerLinkType];

export const BannerPlacement = {
  APP: 'App',
  WEBSITE: 'Website',
  BOTH: 'Both',
} as const;
export type BannerPlacement = (typeof BannerPlacement)[keyof typeof BannerPlacement];

// --- Affiliate program (spec §1.8, §1.14) -----------------------------------------

export const AffiliateWithdrawalStatus = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
} as const;
export type AffiliateWithdrawalStatus =
  (typeof AffiliateWithdrawalStatus)[keyof typeof AffiliateWithdrawalStatus];

export const AffiliateTransactionSource = {
  REFERRAL: 'Referral',
  WITHDRAWAL: 'Withdrawal',
  ADMIN: 'Admin',
  REVERSAL: 'Reversal',
} as const;
export type AffiliateTransactionSource =
  (typeof AffiliateTransactionSource)[keyof typeof AffiliateTransactionSource];

// --- Sidebar module permission keys ------------------------------------------------

export const AdminModule = {
  DASHBOARD: 'dashboard',
  // Catalogue
  PRODUCTS: 'products',
  CATEGORIES: 'categories',
  INVENTORY: 'inventory',
  // Operations
  ORDERS: 'orders',
  CUSTOMERS: 'customers',
  PAYMENTS: 'payments',
  REPLACEMENT: 'replacement',
  REVIEWS: 'reviews',
  // Growth
  SPINNER_CAMPAIGNS: 'spinnerCampaigns',
  COUPONS: 'coupons',
  AFFILIATE: 'affiliate',
  BANNER: 'banner',
  FLASH_SALE: 'flashSale',
  NEW_ARRIVALS: 'newArrivals',
  NOTIFICATIONS: 'notifications',
  // Insights
  REPORTS: 'reports',
  SETTINGS: 'settings',
  SUB_ADMIN: 'subAdmin',
} as const;
export type AdminModule = (typeof AdminModule)[keyof typeof AdminModule];

// --- Notifications (spec §1.18) ---------------------------------------------------

/**
 * NotificationType — the category of a push/broadcast notification. Broadcast/Promotion/System are
 * admin-composed; Order/Wallet/Affiliate/Replacement are system-generated by the customer app / Cloud
 * Functions. Used for the list's colored type badge + type filter.
 */
export const NotificationType = {
  BROADCAST: 'Broadcast',
  ORDER: 'Order',
  PROMOTION: 'Promotion',
  WALLET: 'Wallet',
  AFFILIATE: 'Affiliate',
  REPLACEMENT: 'Replacement',
  SYSTEM: 'System',
} as const;
export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];

/** Who a notification targets: everyone, or a specific set of users. */
export const NotificationTargetType = {
  ALL: 'All',
  SPECIFIC: 'Specific',
} as const;
export type NotificationTargetType = (typeof NotificationTargetType)[keyof typeof NotificationTargetType];

/** The deep-link a notification opens when tapped (spec §1.18). */
export const NotificationLinkType = {
  PRODUCT: 'Product',
  CATEGORY: 'Category',
  ORDER: 'Order',
  NONE: 'None',
} as const;
export type NotificationLinkType = (typeof NotificationLinkType)[keyof typeof NotificationLinkType];
