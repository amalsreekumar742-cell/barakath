import 'package:dartz/dartz.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/error/exceptions.dart';
import '../../../../core/error/failures.dart';
import '../../domain/entities/coupon.dart';
import '../../domain/repositories/coupon_repository.dart';
import '../datasources/coupon_remote_datasource.dart';

@LazySingleton(as: CouponRepository)
class CouponRepositoryImpl implements CouponRepository {
  CouponRepositoryImpl(this._remote);

  final CouponRemoteDataSource _remote;

  @override
  Future<Either<Failure, List<Coupon>>> fetchActive({int limit = 30}) async {
    try {
      return Right(await _remote.fetchActive(limit: limit));
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } catch (_) {
      return const Left(ServerFailure());
    }
  }

  @override
  Future<Either<Failure, Coupon?>> findByCode(String code) async {
    try {
      return Right(await _remote.findByCode(code));
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } catch (_) {
      return const Left(ServerFailure());
    }
  }
}
