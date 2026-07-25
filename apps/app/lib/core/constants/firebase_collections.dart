/// Firestore collection names — the single source of truth for the customer app.
///
/// Every datasource references `FirebaseCollections.xxx` instead of inlining a
/// string literal, so a rename is one edit and typos become analyzer errors.
/// Mirrors the admin/functions collection maps (the shared data contract).
class FirebaseCollections {
  const FirebaseCollections._();

  static const String users = 'users';
  static const String products = 'products';
  static const String variants = 'variants';
  static const String orders = 'orders';
  static const String payments = 'payments';
  static const String categories = 'categories';
  static const String subCategories = 'subCategories';
  static const String walletTransactions = 'walletTransactions';
  static const String affiliateTransactions = 'affiliateTransactions';
  static const String affiliateWithdrawals = 'affiliateWithdrawals';
  static const String coupons = 'coupons';
  static const String reviews = 'reviews';
  static const String spinnerCampaigns = 'spinnerCampaigns';
  static const String spinHistory = 'spinHistory';
  static const String flashSales = 'flashSales';
  static const String banners = 'banners';
  static const String notifications = 'notifications';
  static const String replacements = 'replacements';
  static const String general = 'general';
  static const String addresses = 'addresses';
  static const String wishlist = 'wishlist';

  // --- Batch 4 ---------------------------------------------------------------
  // NOTE ON NAMES: spec §4.1 calls these `replacementRequests`,
  // `withdrawalRequests` and `spinRewards`. The DEPLOYED Cloud Functions and the
  // live admin panel use `replacements` and `affiliateWithdrawals`, so those two
  // stay as they are — renaming them is a coordinated functions + admin + data
  // migration, not an app change (user decision, 2026-07-23).

  // SPIN & WIN — the deployed `spinWheel` function does NOT use spec §4.14/§4.15.
  // Verified against functions/src/growth/spinWheel.ts:
  //   * wheel segments are an INLINE `slots[]` array on the campaign doc, not an
  //     `offers` sub-collection;
  //   * a win mints a normal coupon in `coupons` with a `SPIN-` code prefix
  //     (usageLimit 1, perUserLimit 1, validUntil = +3 days) — there is NO
  //     `spinRewards` collection;
  //   * every spin, win or lose, is recorded in `spinHistory` — there is no
  //     `spinUsage` sub-collection.
  // So "My Coupons" reads `coupons` filtered by the SPIN- prefix, which
  // CouponProvider.myCoupons already does. Do not add spinRewards/offers/spinUsage.

  // Affiliate commission ledger: the deployed name is `affiliateTransactions`
  // (declared above), NOT the spec's `commissionTransactions`. It is a
  // TOP-LEVEL collection filtered by `userId`, not a sub-collection of the user.

  /// Saved payout accounts, max 2 (`users/{uid}/bankAccounts`). New in Batch 4 —
  /// nothing deployed writes it yet, so it takes the spec name.
  static const String bankAccounts = 'bankAccounts';

  /// The single settings document id under `general`.
  static const String configDoc = 'config';
}
