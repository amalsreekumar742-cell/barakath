/**
 * FirestoreCollections — the single source of truth for Firestore collection names.
 *
 * WHY centralize: every app and Cloud Function references `FirestoreCollections.xxx` instead of
 * inlining string literals like 'products'/'orders'. Renaming a collection then becomes a one-line
 * change here, and typos become type errors rather than silent empty queries.
 *
 * Populated in the next step as the data model is defined. `as const` keeps the values as literal
 * types (not widened to `string`) so consumers get exact keys.
 */
export const FirestoreCollections = {
  subAdmins: 'subAdmins',
  orders: 'orders',
  /** Pre-payment checkout holds. A draft becomes an `orders` doc (same id) only once payment succeeds — see functions/src/orders/service/promoteDraft.ts. */
  orderDrafts: 'orderDrafts',
  products: 'products',
  categories: 'categories',
  /** Subcollection under a category: categories/{categoryId}/subCategories/{subCategoryId} (spec §1.4). */
  subCategories: 'subCategories',
  /** Subcollection under a product: products/{productId}/variants/{variantId} (spec §1.5). */
  variants: 'variants',
  /**
   * Master variant data (colour swatches + variant groups) used by the product form (spec §1.21).
   * Deliberately NOT named `variants` — that literal is the per-product subcollection, and the
   * inventory SKU count runs `collectionGroup('variants')`; a top-level `variants` collection would
   * pollute that aggregate. Backed by a single `variables/config` document.
   */
  variables: 'variables',
  /** Audit log of manual stock changes (spec §1.6 Adjust Stock). */
  stockAdjustments: 'stockAdjustments',
  /**
   * `variantCosts/{variantId}` — what the business PAID for one variant ("purchase payment"), the
   * input to the profit report.
   *
   * WHY a separate top-level collection instead of a field on the variant document: variants are
   * world-readable (`firestore.rules`: `products/{id}/variants/{vid}` → `allow read: if true`),
   * because the storefront and the app render them without signing in. Firestore rules gate whole
   * DOCUMENTS, never individual fields, so a `purchasePrice` on the variant would publish the
   * business's cost — and therefore its margin on every product — to anyone who opens the site. This
   * collection is admin-read/write only; Cloud Functions reach it through the Admin SDK.
   *
   * Doc id IS the variant id, so the cost is a direct get with no query or index.
   */
  variantCosts: 'variantCosts',
  /**
   * `orderCosts/{orderId}` — the cost of goods for one order, snapshotted at purchase time.
   *
   * WHY snapshotted rather than read from `variantCosts` when reporting: a variant's purchase price
   * changes over time, so last month's profit must use last month's cost. WHY not on the order
   * document: an order is readable by the customer who placed it (`resource.data.userId ==
   * request.auth.uid`), and a cost line there would show every shopper exactly what you paid.
   *
   * Doc id IS the order id, so the profit report joins by id with no extra index.
   */
  orderCosts: 'orderCosts',
  general: 'general',
  // --- Customers & money (spec §1.8, §1.9) ---
  users: 'users',
  walletTransactions: 'walletTransactions',
  affiliateTransactions: 'affiliateTransactions',
  affiliateWithdrawals: 'affiliateWithdrawals',
  /** Subcollection under a user: users/{userId}/addresses/{addressId} (spec §1.8). */
  addresses: 'addresses',
  /**
   * Subcollection under a user: users/{userId}/wishlist/{productId} — the doc id IS the product id,
   * so "is this wishlisted" is a doc read rather than a query. Already live: the Flutter app writes
   * it and `firestore.rules` scopes it to the owner.
   */
  wishlist: 'wishlist',
  /**
   * Subcollection under a user: users/{userId}/bankAccounts/{accountId} — saved affiliate payout
   * accounts, max 2. Read/written by the customer surfaces only; no Cloud Function touches it.
   */
  bankAccounts: 'bankAccounts',
  payments: 'payments',
  /**
   * Pending/settled wallet top-ups. SERVER-WRITTEN ONLY — `createWalletTopUpOrder` records the amount
   * the Razorpay order was opened for so `verifyWalletTopUp` credits that, not an amount the client
   * sends back after paying. A client may read its own; never write one.
   */
  walletTopUps: 'walletTopUps',
  // --- Operations & growth (spec §1.10, §1.11, §1.12) ---
  /** Product replacement requests (spec §1.10). */
  replacements: 'replacements',
  /** Product reviews written by the user app after delivery (spec §1.11). */
  reviews: 'reviews',
  /** Discount coupons (spec §1.12). */
  coupons: 'coupons',
  /** Spin-the-wheel promotions (spec §1.13). */
  spinnerCampaigns: 'spinnerCampaigns',
  /** Per-spin log; written by the customer app, read by admin (spec §1.13). */
  spinHistory: 'spinHistory',
  /** Home/promo banners (spec §1.15). */
  banners: 'banners',
  /** Flash-sale campaigns (spec §1.16). */
  flashSales: 'flashSales',
  /** Push/broadcast notifications composed in admin, sent via FCM (spec §1.18). */
  notifications: 'notifications',
} as const;

export type FirestoreCollectionName =
  (typeof FirestoreCollections)[keyof typeof FirestoreCollections];

/**
 * NAMES THE SPEC USES THAT THE LIVE DATABASE DOES NOT. Listed so nobody "fixes" the map back.
 *
 * Spec §4.1 calls these `replacementRequests`, `withdrawalRequests` and `spinRewards`; §1.9 calls the
 * commission ledger `commissionTransactions`. The deployed Cloud Functions, the live admin panel and
 * the Flutter app all use `replacements`, `affiliateWithdrawals` and `affiliateTransactions`, and
 * there is no `spinRewards` collection at all — a spin win mints an ordinary `coupons` doc with a
 * `SPIN-` code prefix, and every spin is logged in `spinHistory`. Renaming any of them is a
 * coordinated functions + admin + app + data migration, not a per-surface edit (user decision,
 * 2026-07-23).
 *
 * This matters because querying a collection that does not exist is NOT an error in Firestore — it
 * returns an empty result. A surface built on the spec names renders blank screens and logs nothing.
 *
 * Also deliberately absent: `otpRequests`. `authOTP` parks the MSG91 request id there and no security
 * rule grants access to it, so it is unreachable from any client by design. Cloud Functions keep
 * their own constant for it.
 */

/** Well-known document ids at fixed singleton paths. */
export const FirestoreDocs = {
  /** general/config — store identity, delivery rules, payment toggles, legal HTML. Public read. */
  generalConfig: 'config',
  /** general/secrets — API keys. ADMIN ONLY; never referenced from a client bundle. */
  generalSecrets: 'secrets',
  /** variables/config — master colour swatches and variant groups for the product form. */
  variablesConfig: 'config',
} as const;
