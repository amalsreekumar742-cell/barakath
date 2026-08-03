import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/constants/cloud_functions.dart';
import '../../../../core/constants/firebase_collections.dart';
import '../../../../core/error/exceptions.dart';
import '../../../../core/utils/model_parse.dart';
import '../../../cart/domain/entities/cart_item.dart';
import '../../domain/entities/place_order_result.dart';
import '../../../../core/error/firebase_error_message.dart';

/// The two order callables (spec §2.15). Everything that decides money — line
/// prices, delivery, GST, coupon discount, wallet debit, stock — happens INSIDE
/// these functions. The client sends ids and quantities only.
abstract class CheckoutRemoteDataSource {
  Future<PlaceOrderResult> placeOrder({
    required List<CartItem> items,
    required String addressId,
    String couponCode,
    double walletAmountToUse,
  });

  Future<PaymentVerifyResult> verifyPayment({
    required String razorpayOrderId,
    required String razorpayPaymentId,
    required String razorpaySignature,
  });

  /// Re-read an existing order's Razorpay handles so a failed payment can be
  /// retried against the SAME order rather than creating a duplicate one.
  Future<PlaceOrderResult?> fetchOrderPayment(String orderId);

  /// Cancel an order the customer abandoned without paying, so its reserved
  /// stock, coupon slot and wallet debit come back immediately.
  Future<void> releaseAbandonedOrder(String orderId);
}

@LazySingleton(as: CheckoutRemoteDataSource)
class CheckoutRemoteDataSourceImpl implements CheckoutRemoteDataSource {
  CheckoutRemoteDataSourceImpl(this._functions, this._firestore);

  final FirebaseFunctions _functions;
  final FirebaseFirestore _firestore;

  @override
  Future<PlaceOrderResult> placeOrder({
    required List<CartItem> items,
    required String addressId,
    String couponCode = '',
    double walletAmountToUse = 0,
  }) async {
    try {
      final callable = _functions.httpsCallable(CloudFunctions.createPaymentOrder);
      final response = await callable.call<Map<String, dynamic>>({
        'items': items
            .map((i) => {
                  'productId': i.productId,
                  'variantId': i.variantId,
                  'quantity': i.quantity,
                })
            .toList(),
        'addressId': addressId,
        'couponCode': couponCode,
        'walletAmountToUse': walletAmountToUse,
      });
      final data = Map<String, dynamic>.from(response.data);
      final rzpOrderId = ModelParse.toStr(data['razorpayOrderId']);
      return PlaceOrderResult(
        orderId: ModelParse.toStr(data['orderId']),
        razorpayOrderId: rzpOrderId.isEmpty ? null : rzpOrderId,
        amount: ModelParse.toDouble(data['amount']),
        keyId: ModelParse.toStr(data['key_id']),
      );
    } on FirebaseFunctionsException catch (e) {
      // The function's HttpsError messages are written for the customer
      // ("Only 2 left of …"), so surface them rather than a generic string.
      throw ServerException(FirebaseErrorMessage.of(e) ?? 'Could not place your order.', e.code);
    }
  }

  @override
  Future<PaymentVerifyResult> verifyPayment({
    required String razorpayOrderId,
    required String razorpayPaymentId,
    required String razorpaySignature,
  }) async {
    try {
      final callable = _functions.httpsCallable(CloudFunctions.verifyPayment);
      final response = await callable.call<Map<String, dynamic>>({
        'razorpay_order_id': razorpayOrderId,
        'razorpay_payment_id': razorpayPaymentId,
        'razorpay_signature': razorpaySignature,
      });
      final data = Map<String, dynamic>.from(response.data);
      return PaymentVerifyResult(
        verified: data['verified'] == true,
        orderId: ModelParse.toStr(data['orderId']),
      );
    } on FirebaseFunctionsException catch (e) {
      throw ServerException(FirebaseErrorMessage.of(e) ?? 'Could not confirm your payment.', e.code);
    }
  }

  @override
  Future<PlaceOrderResult?> fetchOrderPayment(String orderId) async {
    if (orderId.isEmpty) return null;
    try {
      // An unpaid checkout is an `orderDrafts` document — `orders/{id}` exists only once payment
      // succeeds. Check `orders` first so a checkout that settled while the customer sat on the
      // failure screen is reported as the real (paid) order rather than a stale draft.
      var snap = await _firestore
          .collection(FirebaseCollections.orders)
          .doc(orderId)
          .get();
      if (!snap.exists) {
        snap = await _firestore
            .collection(FirebaseCollections.orderDrafts)
            .doc(orderId)
            .get();
      }
      final data = snap.data();
      if (data == null) return null;

      final rzpOrderId = ModelParse.toStr(data['razorpayOrderId']);
      return PlaceOrderResult(
        orderId: snap.id,
        razorpayOrderId: rzpOrderId.isEmpty ? null : rzpOrderId,
        amount: ModelParse.toDouble(data['razorpayAmount']),
        // Needed by the payment-expiry countdown on PaymentFailedPage.
        createdAt: ModelParse.dateTime(data['createdAt']),
        status: ModelParse.toStr(data['status']),
      );
    } on FirebaseException catch (e) {
      throw ServerException(FirebaseErrorMessage.of(e) ?? 'Could not load that order.', e.code);
    }
  }

  @override
  Future<void> releaseAbandonedOrder(String orderId) async {
    if (orderId.isEmpty) return;
    // `discardOrderDraft`, not `cancelOrder`: an unpaid checkout is an
    // `orderDrafts` document that has never been an order. The function re-checks
    // ownership and that the draft is still Pending inside its own transaction,
    // so a payment that landed a beat before the sheet closed is left for the
    // webhook to settle instead of having its reservation pulled out from under
    // it.
    await _functions
        .httpsCallable(CloudFunctions.discardOrderDraft)
        .call<Map<String, dynamic>>({'orderId': orderId});
  }
}
