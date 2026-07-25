import 'package:injectable/injectable.dart';

import '../../../products/domain/entities/product.dart';
import '../entities/coupon.dart';
import '../entities/coupon_validation.dart';

/// Pure coupon rules (spec §2.11) — no I/O, so it's a [SyncUseCase]-style helper
/// the provider calls for both the typed code and every listed coupon.
///
/// Order of checks matters: the customer should be told the MOST actionable
/// reason. "Spend ₹200 more" is useful; "not applicable" when it's also expired
/// would send them hunting for the wrong problem.
@injectable
class ValidateCoupon {
  const ValidateCoupon();

  CouponValidation call({
    required Coupon coupon,
    required double subtotal,
    required List<Product> cartProducts,
    DateTime? now,
  }) {
    final at = now ?? DateTime.now();

    if (!coupon.isActive) {
      return const CouponValidation.invalid('This coupon is no longer active');
    }
    if (coupon.validFrom != null && at.isBefore(coupon.validFrom!)) {
      return const CouponValidation.invalid('This coupon isn\'t active yet');
    }
    if (coupon.validUntil != null && at.isAfter(coupon.validUntil!)) {
      return const CouponValidation.invalid('Coupon expired');
    }
    // usageLimit 0 means unlimited — only enforce a positive cap.
    if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) {
      return const CouponValidation.invalid('Coupon usage limit reached');
    }
    if (subtotal < coupon.minimumOrderAmount) {
      return CouponValidation.invalid(
        'Minimum order of ₹${coupon.minimumOrderAmount.toStringAsFixed(0)} required',
      );
    }
    if (!_appliesToCart(coupon, cartProducts)) {
      return const CouponValidation.invalid('Not applicable to items in your bag');
    }

    return CouponValidation.valid(
      coupon: coupon,
      discount: discountFor(coupon: coupon, subtotal: subtotal),
    );
  }

  /// Rupees off. Percentage coupons are capped by `maximumDiscount` when one is
  /// set, and no coupon may ever exceed the subtotal (a discount larger than the
  /// basket would otherwise drive the payable amount negative).
  double discountFor({required Coupon coupon, required double subtotal}) {
    double raw;
    if (coupon.discountType.toLowerCase() == 'percentage') {
      raw = subtotal * coupon.discountValue / 100;
      if (coupon.maximumDiscount > 0 && raw > coupon.maximumDiscount) {
        raw = coupon.maximumDiscount;
      }
    } else {
      raw = coupon.discountValue;
    }
    if (raw < 0) return 0;
    return raw > subtotal ? subtotal : raw;
  }

  /// `applicationType` scopes the coupon: All / Category / Product. An empty
  /// allow-list is treated as "no restriction" rather than "nothing qualifies" —
  /// the admin form leaves it empty when the type is All.
  bool _appliesToCart(Coupon coupon, List<Product> cartProducts) {
    switch (coupon.applicationType.toLowerCase()) {
      case 'category':
        if (coupon.applicableCategories.isEmpty) return true;
        return cartProducts.any(
          (p) => coupon.applicableCategories.contains(p.categoryId),
        );
      case 'product':
        if (coupon.applicableProducts.isEmpty) return true;
        return cartProducts.any((p) => coupon.applicableProducts.contains(p.id));
      default:
        return true;
    }
  }
}
