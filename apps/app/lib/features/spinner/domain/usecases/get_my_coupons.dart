import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/constants/app_dimens.dart';
import '../../../../core/constants/domain_enums.dart';
import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../entities/spin_coupon_page.dart';
import '../repositories/spinner_repository.dart';

class MyCouponsParams extends Equatable {
  const MyCouponsParams({
    required this.status,
    this.startAfter,
    this.limit = AppDimens.pageSize,
  });

  final SpinRewardStatus status;

  /// Opaque cursor from the previous page; null for the first page.
  final Object? startAfter;
  final int limit;

  @override
  List<Object?> get props => [status, startAfter, limit];
}

/// One cursor page of the customer's spin coupons for a single wallet tab.
@injectable
class GetMyCoupons implements UseCase<SpinCouponPage, MyCouponsParams> {
  const GetMyCoupons(this._repository);

  final SpinnerRepository _repository;

  @override
  Future<Either<Failure, SpinCouponPage>> call(MyCouponsParams params) =>
      _repository.getMyCoupons(
        status: params.status,
        startAfter: params.startAfter,
        limit: params.limit,
      );
}
