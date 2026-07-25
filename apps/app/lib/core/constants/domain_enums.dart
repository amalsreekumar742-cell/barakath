/// Domain enums for the customer app, with the EXACT strings each one is stored
/// as in Firestore (spec Part 4).
///
/// WHY `wire` and not `name`: Dart enum names are camelCase, Firestore holds
/// human strings like "Out for delivery". Parsing on `.name` would silently
/// mismatch. Every enum here has a `wire` value and a tolerant `from…` parser
/// that falls back rather than throwing — a document written by a newer admin
/// build must never crash a customer's order list.
library;

// ---------------------------------------------------------------------------
// Orders (spec §4.8 status, §2.17 filters)
// ---------------------------------------------------------------------------

enum OrderStatus {
  pending,
  accepted,
  packed,
  shipped,
  outForDelivery,
  delivered,
  cancelled,
}

extension OrderStatusX on OrderStatus {
  /// The string stored in `orders.status` — also what the UI displays.
  String get label => switch (this) {
        OrderStatus.pending => 'Pending',
        OrderStatus.accepted => 'Accepted',
        OrderStatus.packed => 'Packed',
        OrderStatus.shipped => 'Shipped',
        OrderStatus.outForDelivery => 'Out for delivery',
        OrderStatus.delivered => 'Delivered',
        OrderStatus.cancelled => 'Cancelled',
      };

  /// In flight — everything except the two terminal states. Drives the "Active"
  /// filter tab and whether the tracking timeline is still advancing.
  bool get isActive =>
      this != OrderStatus.delivered && this != OrderStatus.cancelled;

  /// Position in the 6-step tracking timeline; -1 for cancelled, which is shown
  /// as a single terminal state instead of a timeline (spec §2.17).
  int get timelineIndex => switch (this) {
        OrderStatus.pending => 0,
        OrderStatus.accepted => 1,
        OrderStatus.packed => 2,
        OrderStatus.shipped => 3,
        OrderStatus.outForDelivery => 4,
        OrderStatus.delivered => 5,
        OrderStatus.cancelled => -1,
      };

  static OrderStatus from(String? value) {
    final v = (value ?? '').trim().toLowerCase();
    return switch (v) {
      'pending' => OrderStatus.pending,
      'accepted' => OrderStatus.accepted,
      'packed' => OrderStatus.packed,
      'shipped' => OrderStatus.shipped,
      // Accept both spellings: the spec writes "Out for delivery", some admin
      // builds title-case it.
      'out for delivery' || 'outfordelivery' => OrderStatus.outForDelivery,
      'delivered' => OrderStatus.delivered,
      'cancelled' || 'canceled' => OrderStatus.cancelled,
      _ => OrderStatus.pending,
    };
  }

  /// The six steps in order, for rendering the tracking timeline.
  static const List<OrderStatus> timeline = [
    OrderStatus.pending,
    OrderStatus.accepted,
    OrderStatus.packed,
    OrderStatus.shipped,
    OrderStatus.outForDelivery,
    OrderStatus.delivered,
  ];
}

/// The four filter tabs on My Orders (spec §2.17).
enum OrderFilter { all, active, delivered, cancelled }

extension OrderFilterX on OrderFilter {
  String get label => switch (this) {
        OrderFilter.all => 'All',
        OrderFilter.active => 'Active',
        OrderFilter.delivered => 'Delivered',
        OrderFilter.cancelled => 'Cancelled',
      };

  /// Status values to match, or null for "no status clause".
  ///
  /// `active` is a whereIn over five values — Firestore allows that alongside
  /// the createdAt sort with the composite index declared in firestore.indexes.json.
  List<String>? get statuses => switch (this) {
        OrderFilter.all => null,
        OrderFilter.active => [
            OrderStatus.pending.label,
            OrderStatus.accepted.label,
            OrderStatus.packed.label,
            OrderStatus.shipped.label,
            OrderStatus.outForDelivery.label,
          ],
        OrderFilter.delivered => [OrderStatus.delivered.label],
        OrderFilter.cancelled => [OrderStatus.cancelled.label],
      };
}

// ---------------------------------------------------------------------------
// Replacement (spec §4.11, §2.18)
// ---------------------------------------------------------------------------

enum ReplacementStatus { pending, approved, rejected }

extension ReplacementStatusX on ReplacementStatus {
  String get label => switch (this) {
        ReplacementStatus.pending => 'Pending',
        ReplacementStatus.approved => 'Approved',
        ReplacementStatus.rejected => 'Rejected',
      };

  static ReplacementStatus from(String? value) =>
      switch ((value ?? '').trim().toLowerCase()) {
        'approved' => ReplacementStatus.approved,
        'rejected' => ReplacementStatus.rejected,
        _ => ReplacementStatus.pending,
      };
}

/// The four radio options, verbatim from spec §2.18.
///
/// The prototype only draws three (it omits "Quality not as expected") — the
/// spec wins. See docs/design/app/BATCH4_DESIGN_MAP.md §4.
enum ReplacementReason {
  damaged,
  wrongItem,
  noLongerNeeded,
  qualityNotAsExpected,
}

extension ReplacementReasonX on ReplacementReason {
  String get label => switch (this) {
        ReplacementReason.damaged => 'Item damaged/defective',
        ReplacementReason.wrongItem => 'Wrong item delivered',
        ReplacementReason.noLongerNeeded => 'No longer needed',
        ReplacementReason.qualityNotAsExpected => 'Quality not as expected',
      };

  static ReplacementReason? from(String? value) {
    for (final r in ReplacementReason.values) {
      if (r.label.toLowerCase() == (value ?? '').trim().toLowerCase()) return r;
    }
    return null;
  }
}

// ---------------------------------------------------------------------------
// Wallet (spec §4.9 walletTransactions, §2.20)
// ---------------------------------------------------------------------------

enum WalletTxnType { credit, debit }

extension WalletTxnTypeX on WalletTxnType {
  String get label =>
      this == WalletTxnType.credit ? 'Credit' : 'Debit';

  /// Credits read "+₹x" in green, debits "−₹x" in red.
  bool get isCredit => this == WalletTxnType.credit;

  static WalletTxnType from(String? value) =>
      (value ?? '').trim().toLowerCase() == 'debit'
          ? WalletTxnType.debit
          : WalletTxnType.credit;
}

/// Where a wallet movement came from (spec §4.9).
///
/// [label] IS THE WIRE VALUE. These strings are matched against
/// `walletTransactions.source` as written by the Cloud Functions, so they must
/// be exactly what those functions write — `packages/shared/src/types/wallet.ts`
/// declares the vocabulary as 'Refund' | 'Reward' | 'Top-up' | 'Purchase' |
/// 'Admin', and `verifyWalletTopUp` writes 'UPI top-up'.
///
/// Three of these used to read 'Spin reward', 'Order' and 'Admin credit', which
/// nothing on the server has ever written — so an admin credit matched no case
/// and fell through to the neutral "unknown source" glyph, and any breakdown
/// keyed on those labels summed to zero.
///
/// There is deliberately NO cashback source — cashback is removed from the
/// product, though the prototype still draws a Cashback tile.
enum WalletSource { refund, reward, purchase, adminCredit, upiTopUp }

extension WalletSourceX on WalletSource {
  String get label => switch (this) {
        WalletSource.refund => 'Refund',
        WalletSource.reward => 'Reward',
        WalletSource.purchase => 'Purchase',
        WalletSource.adminCredit => 'Admin',
        WalletSource.upiTopUp => 'UPI top-up',
      };

  static WalletSource? from(String? value) {
    for (final s in WalletSource.values) {
      if (s.label.toLowerCase() == (value ?? '').trim().toLowerCase()) return s;
    }
    return null;
  }
}

// ---------------------------------------------------------------------------
// Affiliate (spec §4.9 commissionTransactions, §4.16 withdrawalRequests)
// ---------------------------------------------------------------------------

/// Commission ledger status.
///
/// The DEPLOYED contract (`packages/shared/src/types/affiliate.ts`, written by
/// `clearAffiliateCommissions`) is Pending → Cleared → Withdrawn. Spec §4.9 says
/// "Pending / Confirmed"; `cleared` IS that confirmed state, so the UI labels it
/// "Confirmed" while the wire value stays `Cleared`.
enum CommissionStatus { pending, cleared, withdrawn }

extension CommissionStatusX on CommissionStatus {
  /// The value stored in Firestore.
  String get wire => switch (this) {
        CommissionStatus.pending => 'Pending',
        CommissionStatus.cleared => 'Cleared',
        CommissionStatus.withdrawn => 'Withdrawn',
      };

  /// What the customer reads. "Cleared" is internal vocabulary; an affiliate
  /// looking at their earnings understands "Confirmed".
  String get label => switch (this) {
        CommissionStatus.pending => 'Pending',
        CommissionStatus.cleared => 'Confirmed',
        CommissionStatus.withdrawn => 'Withdrawn',
      };

  static CommissionStatus from(String? value) =>
      switch ((value ?? '').trim().toLowerCase()) {
        'cleared' || 'confirmed' => CommissionStatus.cleared,
        'withdrawn' => CommissionStatus.withdrawn,
        _ => CommissionStatus.pending,
      };
}

enum WithdrawalStatus { pending, approved, rejected }

extension WithdrawalStatusX on WithdrawalStatus {
  String get label => switch (this) {
        WithdrawalStatus.pending => 'Pending',
        WithdrawalStatus.approved => 'Approved',
        WithdrawalStatus.rejected => 'Rejected',
      };

  static WithdrawalStatus from(String? value) =>
      switch ((value ?? '').trim().toLowerCase()) {
        'approved' => WithdrawalStatus.approved,
        'rejected' => WithdrawalStatus.rejected,
        _ => WithdrawalStatus.pending,
      };
}

// ---------------------------------------------------------------------------
// Spin rewards (spec §4.15)
// ---------------------------------------------------------------------------

enum SpinRewardStatus { active, used, expired }

extension SpinRewardStatusX on SpinRewardStatus {
  String get label => switch (this) {
        SpinRewardStatus.active => 'Active',
        SpinRewardStatus.used => 'Used',
        SpinRewardStatus.expired => 'Expired',
      };

  static SpinRewardStatus from(String? value) =>
      switch ((value ?? '').trim().toLowerCase()) {
        'used' => SpinRewardStatus.used,
        'expired' => SpinRewardStatus.expired,
        _ => SpinRewardStatus.active,
      };
}

/// Campaign audience gate (spec §4.14 eligibility).
enum SpinEligibility { allUsers, newUsers, affiliates }

extension SpinEligibilityX on SpinEligibility {
  String get label => switch (this) {
        SpinEligibility.allUsers => 'All users',
        SpinEligibility.newUsers => 'New users',
        SpinEligibility.affiliates => 'Affiliates',
      };

  static SpinEligibility from(String? value) =>
      switch ((value ?? '').trim().toLowerCase()) {
        'new users' => SpinEligibility.newUsers,
        'affiliates' => SpinEligibility.affiliates,
        _ => SpinEligibility.allUsers,
      };
}

// ---------------------------------------------------------------------------
// Notifications (spec §4.18)
// ---------------------------------------------------------------------------

/// Where a notification tap lands. Resolved to a route by
/// `features/notifications/.../notification_router.dart`.
enum NotificationDeepLink {
  home,
  product,
  category,
  flashSale,
  spinner,
  order,
  wallet,
  coupons,
}

extension NotificationDeepLinkX on NotificationDeepLink {
  String get label => switch (this) {
        NotificationDeepLink.home => 'Home',
        NotificationDeepLink.product => 'Product',
        NotificationDeepLink.category => 'Category',
        NotificationDeepLink.flashSale => 'Flash sale',
        NotificationDeepLink.spinner => 'Spinner',
        NotificationDeepLink.order => 'Order',
        NotificationDeepLink.wallet => 'Wallet',
        NotificationDeepLink.coupons => 'Coupons',
      };

  /// Does this destination need a `referenceId` to be meaningful? A Product
  /// link without one must fall back to Home rather than opening `/product/`.
  bool get needsReference =>
      this == NotificationDeepLink.product ||
      this == NotificationDeepLink.category ||
      this == NotificationDeepLink.order;

  static NotificationDeepLink from(String? value) {
    final v = (value ?? '').trim().toLowerCase();
    for (final d in NotificationDeepLink.values) {
      if (d.label.toLowerCase() == v) return d;
    }
    // Tolerate the no-space spellings a push payload might carry.
    return switch (v) {
      'flashsale' => NotificationDeepLink.flashSale,
      'mycoupons' => NotificationDeepLink.coupons,
      _ => NotificationDeepLink.home,
    };
  }
}

/// Broadcast audience for `type == "admin"` notifications (spec §4.18).
enum NotificationAudience { allUsers, orderUpdates, active30d }

extension NotificationAudienceX on NotificationAudience {
  String get label => switch (this) {
        NotificationAudience.allUsers => 'All users',
        NotificationAudience.orderUpdates => 'Order updates',
        NotificationAudience.active30d => 'Active 30d',
      };

  static NotificationAudience from(String? value) =>
      switch ((value ?? '').trim().toLowerCase()) {
        'order updates' => NotificationAudience.orderUpdates,
        'active 30d' => NotificationAudience.active30d,
        _ => NotificationAudience.allUsers,
      };
}
