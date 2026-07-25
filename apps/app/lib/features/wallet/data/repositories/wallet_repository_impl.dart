import 'package:dartz/dartz.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/constants/app_dimens.dart';
import '../../../../core/error/exceptions.dart';
import '../../../../core/error/failures.dart';
import '../../domain/entities/wallet_breakdown.dart';
import '../../domain/entities/wallet_top_up_order.dart';
import '../../domain/repositories/wallet_repository.dart';
import '../datasources/wallet_remote_datasource.dart';

@LazySingleton(as: WalletRepository)
class WalletRepositoryImpl implements WalletRepository {
  WalletRepositoryImpl(this._remote);

  final WalletRemoteDataSource _remote;

  @override
  Stream<double> watchBalance(String uid) => _remote.watchBalance(uid);

  @override
  Future<Either<Failure, WalletTransactionPage>> fetchTransactions({
    required String uid,
    Object? startAfter,
    int limit = AppDimens.pageSize,
  }) async {
    try {
      final page = await _remote.fetchTransactions(
        uid: uid,
        startAfter: startAfter,
        limit: limit,
      );
      return Right(
        WalletTransactionPage(
          items: page.items,
          // Passed straight back through as an opaque token on the next call.
          nextCursor: page.nextCursor,
          hasMore: page.hasMore,
        ),
      );
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } catch (_) {
      return const Left(ServerFailure());
    }
  }

  @override
  Future<Either<Failure, WalletBreakdown>> fetchBreakdown(String uid) async {
    try {
      return Right(await _remote.fetchBreakdown(uid));
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } catch (_) {
      return const Left(ServerFailure());
    }
  }

  @override
  Future<Either<Failure, WalletTopUpOrder>> createTopUpOrder(
    double amount,
  ) async {
    try {
      return Right(await _remote.createTopUpOrder(amount));
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } catch (_) {
      return const Left(ServerFailure());
    }
  }

  @override
  Future<Either<Failure, double?>> verifyTopUp({
    required String razorpayOrderId,
    required String razorpayPaymentId,
    required String razorpaySignature,
  }) async {
    try {
      return Right(
        await _remote.verifyTopUp(
          razorpayOrderId: razorpayOrderId,
          razorpayPaymentId: razorpayPaymentId,
          razorpaySignature: razorpaySignature,
        ),
      );
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } catch (_) {
      return const Left(ServerFailure());
    }
  }
}
