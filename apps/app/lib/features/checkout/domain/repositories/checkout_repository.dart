import 'package:dartz/dartz.dart';

import '../../../../core/error/failures.dart';
import '../../../cart/domain/entities/cart_item.dart';
import '../entities/place_order_result.dart';

abstract class CheckoutRepository {
  Future<Either<Failure, PlaceOrderResult>> placeOrder({
    required List<CartItem> items,
    required String addressId,
    String couponCode,
    double walletAmountToUse,
  });

  Future<Either<Failure, PaymentVerifyResult>> verifyPayment({
    required String razorpayOrderId,
    required String razorpayPaymentId,
    required String razorpaySignature,
  });

  /// Null on the Right side = no such order.
  Future<Either<Failure, PlaceOrderResult?>> fetchOrderPayment(String orderId);
}
