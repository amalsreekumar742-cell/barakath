import 'package:flutter/foundation.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/usecase/usecase.dart';
import '../../../products/domain/entities/product.dart';
import '../../domain/entities/coupon.dart';
import '../../domain/entities/coupon_validation.dart';
import '../../domain/usecases/find_coupon_by_code.dart';
import '../../domain/usecases/get_active_coupons.dart';
import '../../domain/usecases/validate_coupon.dart';

/// Backs the coupon picker (spec §2.11). Validation here is a PRE-CHECK so the
/// customer gets an instant, specific reason; `createPaymentOrder` re-validates
/// and recomputes the discount before any money moves.
@injectable
class CouponProvider extends ChangeNotifier {
  CouponProvider(this._getActiveCoupons, this._findCouponByCode, this._validateCoupon);

  final GetActiveCoupons _getActiveCoupons;
  final FindCouponByCode _findCouponByCode;
  final ValidateCoupon _validateCoupon;

  List<Coupon> _coupons = [];
  bool _isLoading = true;
  bool _applyLoading = false;
  String? _error;

  /// Every live coupon, general ones first. Spin-wheel prizes are personal and
  /// listed separately (spec §2.11 "My Coupons").
  List<Coupon> get availableCoupons =>
      _coupons.where((c) => !_isSpinCoupon(c)).toList(growable: false);

  List<Coupon> get myCoupons =>
      _coupons.where(_isSpinCoupon).toList(growable: false);

  bool get isLoading => _isLoading;
  bool get applyLoading => _applyLoading;
  String? get error => _error;

  /// Spin-wheel winnings are issued as `SPIN-…` codes with a single use.
  bool _isSpinCoupon(Coupon c) => c.code.toUpperCase().startsWith('SPIN-');

  Future<void> fetchCoupons() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    final result = await _getActiveCoupons(const NoParams());
    result.fold(
      (failure) => _error = failure.message,
      (coupons) {
        final now = DateTime.now();
        // The query can't range-filter validUntil alongside the isActive
        // equality without another composite index, so expiry is dropped here.
        _coupons = coupons
            .where((c) => c.validUntil == null || c.validUntil!.isAfter(now))
            .toList();
      },
    );

    _isLoading = false;
    notifyListeners();
  }

  /// Check a coupon the customer typed in.
  Future<CouponValidation> validateCode({
    required String code,
    required double subtotal,
    required List<Product> cartProducts,
  }) async {
    if (code.trim().isEmpty) {
      return const CouponValidation.invalid('Enter a coupon code');
    }

    _applyLoading = true;
    notifyListeners();

    final result = await _findCouponByCode(code);
    final validation = result.fold(
      (failure) => CouponValidation.invalid(failure.message),
      (coupon) => coupon == null
          ? const CouponValidation.invalid('Invalid coupon code')
          : validate(
              coupon: coupon,
              subtotal: subtotal,
              cartProducts: cartProducts,
            ),
    );

    _applyLoading = false;
    notifyListeners();
    return validation;
  }

  /// Check an already-loaded coupon (the list's Apply buttons).
  CouponValidation validate({
    required Coupon coupon,
    required double subtotal,
    required List<Product> cartProducts,
  }) =>
      _validateCoupon(
        coupon: coupon,
        subtotal: subtotal,
        cartProducts: cartProducts,
      );
}
