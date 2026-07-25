// Cross-cutting technical constants (not app-identity/design — those live in
// `core/constants/`). Pagination page sizes and SharedPreferences keys.

/// Cursor page sizes for paginated Firestore lists. Pick per list-item weight
/// (skill rule: heavy items 10, medium 12–13, light 15) — don't reuse one number
/// blindly. [defaultPageSize] is the medium/balanced default.
class PageSizes {
  const PageSizes._();

  static const int defaultPageSize = 12;
  static const int heavy = 10; // image cards, detailed rows
  static const int light = 15; // single-line / chip lists
}

/// SharedPreferences keys — referenced instead of inlining string literals.
class PrefKeys {
  const PrefKeys._();

  static const String onboardingComplete = 'onboardingComplete';
  static const String cart = 'cart_items';
  static const String recentSearches = 'recent_searches';

  /// Ids of notifications the customer has opened. Read state is deliberately
  /// LOCAL ONLY (spec §4.18) — no Firestore field, no sub-collection.
  static const String readNotificationIds = 'read_notification_ids';
}
