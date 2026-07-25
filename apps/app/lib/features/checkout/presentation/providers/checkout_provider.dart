import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:injectable/injectable.dart';

import '../../../address/domain/entities/address.dart';
import '../../../cart/domain/entities/cart_item.dart';
import '../../domain/entities/place_order_result.dart';
import '../../domain/usecases/checkout_usecases.dart';

/// Drives the checkout screen (spec §2.13, §2.15).
///
/// It holds the customer's SELECTIONS (address, how much wallet to spend) and
/// relays them to `createPaymentOrder`. It deliberately computes no money of its
/// own beyond the wallet split preview — the bill is the server's.
@injectable
class CheckoutProvider extends ChangeNotifier {
  CheckoutProvider(this._placeOrder, this._verifyPayment, this._getOrderPayment);

  final PlaceOrder _placeOrder;
  final VerifyPayment _verifyPayment;
  final GetOrderPayment _getOrderPayment;

  Address? _selectedAddress;
  bool _useWallet = false;
  double _walletAmountToUse = 0;
  bool _isPlacingOrder = false;
  String? _error;

  Address? get selectedAddress => _selectedAddress;
  bool get useWallet => _useWallet;
  double get walletAmountToUse => _walletAmountToUse;
  bool get isPlacingOrder => _isPlacingOrder;
  String? get error => _error;

  void selectAddress(Address address) {
    _selectedAddress = address;
    notifyListeners();
  }

  /// Pre-select the default address, but never clobber an explicit choice the
  /// customer already made (they may have come back from "Change").
  void preselectAddress(Address? address) {
    if (_selectedAddress != null || address == null) return;
    _selectedAddress = address;
    notifyListeners();
  }

  /// Wallet can cover the whole bill — [maxUsable] is the order total, so a rich
  /// enough wallet drives the Razorpay amount to zero and skips the sheet.
  void toggleWalletUsage({
    required bool use,
    required double walletBalance,
    required double maxUsable,
  }) {
    _useWallet = use;
    _walletAmountToUse = use ? math.max(0, math.min(walletBalance, maxUsable)) : 0;
    notifyListeners();
  }

  /// Keep the wallet split honest when the bill moves (coupon applied, quantity
  /// changed) — otherwise a stale amount could exceed the new total.
  void reconcileWallet({required double walletBalance, required double maxUsable}) {
    if (!_useWallet) return;
    final next = math.max(0.0, math.min(walletBalance, maxUsable));
    if (next == _walletAmountToUse) return;
    _walletAmountToUse = next;
    notifyListeners();
  }

  Future<PlaceOrderResult?> placeOrder({
    required List<CartItem> items,
    required String addressId,
    String couponCode = '',
  }) async {
    _isPlacingOrder = true;
    _error = null;
    notifyListeners();

    final result = await _placeOrder(PlaceOrderParams(
      items: items,
      addressId: addressId,
      couponCode: couponCode,
      walletAmountToUse: _walletAmountToUse,
    ));

    PlaceOrderResult? placed;
    result.fold(
      (failure) => _error = failure.message,
      (value) => placed = value,
    );

    _isPlacingOrder = false;
    notifyListeners();
    return placed;
  }

  Future<PaymentVerifyResult?> verifyPayment({
    required String razorpayOrderId,
    required String razorpayPaymentId,
    required String razorpaySignature,
  }) async {
    final result = await _verifyPayment(VerifyPaymentParams(
      razorpayOrderId: razorpayOrderId,
      razorpayPaymentId: razorpayPaymentId,
      razorpaySignature: razorpaySignature,
    ));

    PaymentVerifyResult? verified;
    result.fold(
      (failure) => _error = failure.message,
      (value) => verified = value,
    );
    if (verified == null) notifyListeners();
    return verified;
  }

  /// Re-read an order so a failed payment can be retried against the SAME
  /// Razorpay order — placing a new one would double-charge stock and coupons.
  Future<PlaceOrderResult?> loadOrderForRetry(String orderId) async {
    final result = await _getOrderPayment(orderId);
    PlaceOrderResult? order;
    result.fold((failure) => _error = failure.message, (value) => order = value);
    if (order == null) notifyListeners();
    return order;
  }

  /// Forget the checkout selections once an order is placed, so the next one
  /// doesn't inherit a spent wallet amount.
  void reset() {
    _useWallet = false;
    _walletAmountToUse = 0;
    _error = null;
    notifyListeners();
  }
}
