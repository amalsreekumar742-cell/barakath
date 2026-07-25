import 'package:dartz/dartz.dart' hide Order;
import 'package:injectable/injectable.dart' hide Order;

import '../../../../core/constants/domain_enums.dart';
import '../../../../core/error/exceptions.dart';
import '../../../../core/error/failures.dart';
import '../../../replacement/domain/entities/replacement.dart';
import '../../domain/entities/invoice_business.dart';
import '../../domain/entities/order.dart';
import '../../domain/repositories/order_repository.dart';
import '../datasources/order_remote_datasource.dart';

/// Catches the datasource's exceptions and returns `Either<Failure, T>`.
@LazySingleton(as: OrderRepository)
class OrderRepositoryImpl implements OrderRepository {
  OrderRepositoryImpl(this._remote);

  final OrderRemoteDataSource _remote;

  @override
  Future<Either<Failure, OrderPageResult>> getOrders({
    required OrderFilter filter,
    int limit = 12,
    Object? startAfter,
  }) async {
    try {
      final page = await _remote.getOrders(
        filter: filter,
        limit: limit,
        startAfter: startAfter,
      );
      return Right(
        OrderPageResult(
          items: page.items,
          nextCursor: page.nextCursor,
          hasMore: page.hasMore,
        ),
      );
    } on AuthException catch (e) {
      return Left(AuthFailure(e.message));
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } catch (_) {
      return const Left(ServerFailure());
    }
  }

  @override
  Future<Either<Failure, Order>> getOrderById(String orderId) async {
    try {
      return Right(await _remote.getOrderById(orderId));
    } on AuthException catch (e) {
      return Left(AuthFailure(e.message));
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } catch (_) {
      return const Left(ServerFailure());
    }
  }

  @override
  Future<Either<Failure, Replacement?>> getItemReplacement({
    required String orderId,
    required String productId,
    required String variantId,
  }) async {
    try {
      return Right(
        await _remote.getItemReplacement(
          orderId: orderId,
          productId: productId,
          variantId: variantId,
        ),
      );
    } on AuthException catch (e) {
      return Left(AuthFailure(e.message));
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } catch (_) {
      return const Left(ServerFailure());
    }
  }

  @override
  Future<Either<Failure, Unit>> cancelOrder({
    required String orderId,
    required String reason,
  }) async {
    try {
      await _remote.cancelOrder(orderId: orderId, reason: reason);
      return const Right(unit);
    } on AuthException catch (e) {
      return Left(AuthFailure(e.message));
    } on ServerException catch (e) {
      // `permission-denied` here means the deployed callable still gates on the
      // admin claim — surface the server's own words rather than pretending the
      // cancellation is merely "temporarily unavailable".
      return Left(ServerFailure(e.message));
    } catch (_) {
      return const Left(ServerFailure());
    }
  }

  @override
  Future<Either<Failure, String>> generateInvoice(String orderId) async {
    try {
      return Right(await _remote.generateInvoice(orderId));
    } on AuthException catch (e) {
      return Left(AuthFailure(e.message));
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } catch (_) {
      return const Left(ServerFailure());
    }
  }

  @override
  Future<Either<Failure, InvoiceBusiness>> getInvoiceBusiness() async {
    try {
      return Right(await _remote.getInvoiceBusiness());
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } catch (_) {
      return const Left(ServerFailure());
    }
  }
}
