/**
 * Constants — website app identity, config values, thresholds, storage keys.
 * WHY grouped as one `as const` object: referenced as `Constants.xxx` everywhere; never inline these
 *   literals inside features.
 */
export const Constants = {
  APP_NAME: 'Barakath',

  /**
   * Default cursor page size for every paginated list (the web skill's default).
   * A heavy image grid may drop to 10 and a light row list rise to 15 — but pass that explicitly
   * rather than changing this, which every screen shares.
   */
  PAGE_SIZE: 12,

  /**
   * Bounded caps for reads that are genuinely "fetch the whole set".
   * WHY caps rather than pagination: the mega menu, a product's variant selector and the banner
   * carousel each need their full list to render at once, and each is small by nature. The skill
   * forbids an UNBOUNDED read, not a bounded one — but a cap must be a deliberate number with a
   * reason, so that outgrowing it surfaces in review instead of silently truncating the UI.
   */
  MAX_CATEGORIES: 60,
  MAX_SUBCATEGORIES: 40,
  MAX_VARIANTS: 40,
  MAX_BANNERS: 12,

  /** The sitemap is the one place that legitimately wants the whole catalogue. */
  SITEMAP_MAX_PRODUCTS: 5000,

  DEFAULT_COUNTRY_CODE: '+91',
  /** Indian mobile numbers are 10 digits; the OTP form validates against this. */
  PHONE_DIGITS: 10,
  /** Cart line quantity cap (spec §2.11 "± max 10"), independent of live stock. */
  CART_MAX_QTY: 10,
  /** Bounded read cap for a customer's saved addresses — mirrors the Flutter app's `fetchAddresses`
   *  default limit; nobody has anywhere near this many delivery addresses. */
  MAX_ADDRESSES: 20,
  /** Seconds before "Resend OTP" becomes active again (spec 3.3). */
  OTP_RESEND_SECONDS: 30,
  OTP_LENGTH: 6,

  /** Debounce before the header's search suggestions query Firestore. */
  SEARCH_DEBOUNCE_MS: 300,
  /** Below this many characters the search dropdown shows recent searches only. */
  SEARCH_MIN_CHARS: 2,
  /** Suggestions shown per group (Products / Categories / Sub-categories). */
  SEARCH_GROUP_LIMIT: 5,
  /** Hard cap on a raw `?q=` value before it reaches Firestore — an unbounded query string is a cheap
   * way to build a pathological `array-contains-any` call (which itself caps at 30 values). */
  SEARCH_QUERY_MAX_LENGTH: 100,

  // --- localStorage keys (one namespace so a clear-site-data wipe is predictable) ---
  STORAGE_KEY_CART: 'barakath.cart',
  STORAGE_KEY_RECENT_SEARCHES: 'barakath.recentSearches',
  MAX_RECENT_SEARCHES: 8,
  /** Read notification ids (spec 3.18: "Read status via localStorage", no Firestore write — a
   *  broadcast doc is shared across every recipient, so "read" cannot live on the document itself). */
  STORAGE_KEY_READ_NOTIFICATIONS: 'barakath.readNotifications',

  /** The httpOnly cookie the middleware reads to decide whether a visitor is signed in. */
  SESSION_COOKIE: 'barakath_session',

  /**
   * Bounded-batch wishlist clear on account deletion — mirrors `apps/app`'s
   * `profile_remote_datasource.dart` `_wishlistBatchSize`/`_maxWishlistBatches` EXACTLY
   * (WEB_BATCH4_NOTES.md §2) so both clients bound the same way instead of looping unbounded
   * against a live collection.
   */
  WISHLIST_DELETE_BATCH_SIZE: 400,
  WISHLIST_DELETE_MAX_BATCHES: 10,

  // --- Affiliate (spec §1.14, §2.22, §3.16) ---
  /** Minimum withdrawal amount — mirrors `firestore.rules`' own `affiliateWithdrawals` create check
   *  (`amount >= 10000`), so the client-side message and the server rejection can never disagree. */
  AFFILIATE_MIN_WITHDRAWAL: 10000,
  /** Currently ₹0 — spec §1.14/§2.22. Shown in the withdrawal summary only; there is no
   *  `processingFee` field enforced anywhere server-side. */
  AFFILIATE_PROCESSING_FEE: 0,
  /** Max saved payout accounts per affiliate (spec §2.22) — a UI cap, not a security boundary
   *  (`firestore.rules` cannot count sibling documents). */
  AFFILIATE_MAX_BANK_ACCOUNTS: 2,
  /** Razorpay's free, public IFSC directory (spec §2.22 "IFSC (auto-verify)") — confirmed to send
   *  `Access-Control-Allow-Origin: *`, so a direct browser fetch works with no server proxy needed. */
  IFSC_LOOKUP_BASE_URL: 'https://ifsc.razorpay.com',
} as const;
