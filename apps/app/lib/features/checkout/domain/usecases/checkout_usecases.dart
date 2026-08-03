import 'package:dartz/dartz.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../../../cart/domain/entities/cart_item.dart';
import '../entities/place_order_result.dart';
import '../repositories/checkout_repository.dart';

@injectable
class PlaceOrder implements UseCase<PlaceOrderResult, PlaceOrderParams> {
  PlaceOrder(this._repository);
  final CheckoutRepository _repository;

  @override
  Future<Either<Failure, PlaceOrderResult>> call(PlaceOrderParams params) =>
      _repository.placeOrder(
        items: params.items,
        addressId: params.addressId,
        couponCode: params.couponCode,
        walletAmountToUse: params.walletAmountToUse,
      );
}

class PlaceOrderParams {
  const PlaceOrderParams({
    required this.items,
    required this.addressId,
    this.couponCode = '',
    this.walletAmountToUse = 0,
  });

  final List<CartItem> items;
  final String addressId;
  final String couponCode;
  final double walletAmountToUse;
}

@injectable
class VerifyPayment implements UseCase<PaymentVerifyResult, VerifyPaymentParams> {
  VerifyPayment(this._repository);
  final CheckoutRepository _repository;

  @override
  Future<Either<Failure, PaymentVerifyResult>> call(VerifyPaymentParams params) =>
      _repository.verifyPayment(
        razorpayOrderId: params.razorpayOrderId,
        razorpayPaymentId: params.razorpayPaymentId,
        razorpaySignature: params.razorpaySignature,
      );
}

@injectable
class GetOrderPayment implements UseCase<PlaceOrderResult?, String> {
  GetOrderPayment(this._repository);
  final CheckoutRepository _repository;

  @override
  Future<Either<Failure, PlaceOrderResult?>> call(String params) =>
      _repository.fetchOrderPayment(params);
}

/// Cancel an order the customer abandoned without paying, so the stock, coupon
/// slot and wallet debit it reserved come back at once instead of after the
/// server's 10-minute sweep.
@injectable
class ReleaseAbandonedOrder implements UseCase<Unit, String> {
  ReleaseAbandonedOrder(this._repository);
  final CheckoutRepository _repository;

  @override
  Future<Either<Failure, Unit>> call(String params) =>
      _repository.releaseAbandonedOrder(params);
}

class VerifyPaymentParams {
  const VerifyPaymentParams({
    required this.razorpayOrderId,
    required this.razorpayPaymentId,
    required this.razorpaySignature,
  });

  final String razorpayOrderId;
  final String razorpayPaymentId;
  final String razorpaySignature;
}
