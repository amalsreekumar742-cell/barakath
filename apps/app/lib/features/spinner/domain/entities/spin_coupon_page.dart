import 'package:equatable/equatable.dart';

import '../../../checkout/domain/entities/coupon.dart';

/// One cursor page of the customer's coupon wallet.
///
/// Reuses the checkout feature's `Coupon` entity on purpose: My Coupons is a
/// read-only view over the SAME `coupons` documents the Apply-Coupon screen
/// applies. A second entity here would be two parsers for one contract, free to
/// drift.
///
/// [nextCursor] is an opaque `Object?` so the Firestore `DocumentSnapshot` never
/// leaks into domain; only the datasource knows what it really is.
class SpinCouponPage extends Equatable {
  const SpinCouponPage({
    required this.items,
    required this.nextCursor,
    required this.hasMore,
  });

  final List<Coupon> items;
  final Object? nextCursor;
  final bool hasMore;

  static const SpinCouponPage empty =
      SpinCouponPage(items: [], nextCursor: null, hasMore: false);

  @override
  List<Object?> get props => [items, nextCursor, hasMore];
}
