import 'package:dartz/dartz.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../entities/coupon.dart';
import '../repositories/coupon_repository.dart';

@injectable
class GetActiveCoupons implements UseCase<List<Coupon>, NoParams> {
  GetActiveCoupons(this._repository);

  final CouponRepository _repository;

  @override
  Future<Either<Failure, List<Coupon>>> call(NoParams params) =>
      _repository.fetchActive(limit: 30);
}
