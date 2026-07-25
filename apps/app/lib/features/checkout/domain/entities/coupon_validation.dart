import 'package:equatable/equatable.dart';

import 'coupon.dart';

/// Outcome of checking a coupon against the current bag.
///
/// WHY a result object rather than a thrown failure: "this coupon doesn't apply"
/// is a normal answer the UI shows inline next to the coupon, not an error path.
///
/// This check is a PRE-CHECK only. `createPaymentOrder` re-validates the code and
/// recomputes the discount server-side, so a tampered client can't invent one.
class CouponValidation extends Equatable {
  const CouponValidation._({
    required this.isValid,
    this.error,
    this.coupon,
    this.discount = 0,
  });

  const CouponValidation.valid({required Coupon coupon, required double discount})
      : this._(isValid: true, coupon: coupon, discount: discount);

  const CouponValidation.invalid(String reason, {Coupon? coupon})
      : this._(isValid: false, error: reason, coupon: coupon);

  final bool isValid;

  /// Customer-facing reason the coupon can't be used ("Coupon expired", …).
  final String? error;
  final Coupon? coupon;

  /// Rupees off the subtotal. Always 0 when [isValid] is false.
  final double discount;

  @override
  List<Object?> get props => [isValid, error, coupon, discount];
}
