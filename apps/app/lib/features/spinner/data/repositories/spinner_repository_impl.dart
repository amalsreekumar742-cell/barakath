import 'package:dartz/dartz.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/constants/app_dimens.dart';
import '../../../../core/constants/domain_enums.dart';
import '../../../../core/error/exceptions.dart';
import '../../../../core/error/failures.dart';
import '../../domain/entities/customer_audience.dart';
import '../../domain/entities/spin_coupon_page.dart';
import '../../domain/entities/spin_result.dart';
import '../../domain/entities/spin_tally.dart';
import '../../domain/entities/spinner_campaign.dart';
import '../../domain/repositories/spinner_repository.dart';
import '../datasources/spinner_remote_datasource.dart';

@LazySingleton(as: SpinnerRepository)
class SpinnerRepositoryImpl implements SpinnerRepository {
  SpinnerRepositoryImpl(this._remote);

  final SpinnerRemoteDataSource _remote;

  @override
  Future<Either<Failure, SpinnerCampaign?>> getActiveCampaign() async {
    try {
      return Right(await _remote.fetchActiveCampaign());
    } on AuthException catch (e) {
      return Left(AuthFailure(e.message));
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } catch (_) {
      return const Left(ServerFailure());
    }
  }

  @override
  Future<Either<Failure, SpinTally>> getSpinTally(String campaignId) async {
    try {
      return Right(await _remote.fetchSpinTally(campaignId));
    } on AuthException catch (e) {
      return Left(AuthFailure(e.message));
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } catch (_) {
      return const Left(ServerFailure());
    }
  }

  @override
  Future<Either<Failure, CustomerAudience>> getCustomerAudience() async {
    try {
      return Right(await _remote.fetchCustomerAudience());
    } on AuthException catch (e) {
      return Left(AuthFailure(e.message));
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } catch (_) {
      return const Left(ServerFailure());
    }
  }

  @override
  Future<Either<Failure, SpinResult>> spin(String campaignId) async {
    try {
      return Right(await _remote.spin(campaignId));
    } on AuthException catch (e) {
      return Left(AuthFailure(e.message));
    } on ServerException catch (e) {
      // Carries the callable's own message — the provider shows it as-is.
      return Left(ServerFailure(e.message));
    } catch (_) {
      return const Left(ServerFailure());
    }
  }

  @override
  Future<Either<Failure, SpinCouponPage>> getMyCoupons({
    required SpinRewardStatus status,
    Object? startAfter,
    int limit = AppDimens.pageSize,
  }) async {
    try {
      return Right(
        await _remote.fetchMyCoupons(
          status: status,
          startAfter: startAfter,
          limit: limit,
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
}
