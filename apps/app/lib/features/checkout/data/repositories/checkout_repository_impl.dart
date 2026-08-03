import 'package:dartz/dartz.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/error/exceptions.dart';
import '../../../../core/error/failures.dart';
import '../../../cart/domain/entities/cart_item.dart';
import '../../domain/entities/place_order_result.dart';
import '../../domain/repositories/checkout_repository.dart';
import '../datasources/checkout_remote_datasource.dart';

@LazySingleton(as: CheckoutRepository)
class CheckoutRepositoryImpl implements CheckoutRepository {
  CheckoutRepositoryImpl(this._remote);

  final CheckoutRemoteDataSource _remote;

  @override
  Future<Either<Failure, PlaceOrderResult>> placeOrder({
    required List<CartItem> items,
    required String addressId,
    String couponCode = '',
    double walletAmountToUse = 0,
  }) async {
    try {
      return Right(await _remote.placeOrder(
        items: items,
        addressId: addressId,
        couponCode: couponCode,
        walletAmountToUse: walletAmountToUse,
      ));
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } catch (_) {
      return const Left(ServerFailure());
    }
  }

  @override
  Future<Either<Failure, PaymentVerifyResult>> verifyPayment({
    required String razorpayOrderId,
    required String razorpayPaymentId,
    required String razorpaySignature,
  }) async {
    try {
      return Right(await _remote.verifyPayment(
        razorpayOrderId: razorpayOrderId,
        razorpayPaymentId: razorpayPaymentId,
        razorpaySignature: razorpaySignature,
      ));
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } catch (_) {
      return const Left(ServerFailure());
    }
  }

  @override
  Future<Either<Failure, PlaceOrderResult?>> fetchOrderPayment(
      String orderId) async {
    try {
      return Right(await _remote.fetchOrderPayment(orderId));
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } catch (_) {
      return const Left(ServerFailure());
    }
  }

  @override
  Future<Either<Failure, Unit>> releaseAbandonedOrder(String orderId) async {
    try {
      await _remote.releaseAbandonedOrder(orderId);
      return const Right(unit);
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } catch (_) {
      return const Left(ServerFailure());
    }
  }
}
