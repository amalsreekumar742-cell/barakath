import 'package:dartz/dartz.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../entities/coupon.dart';
import '../repositories/coupon_repository.dart';

@injectable
class FindCouponByCode implements UseCase<Coupon?, String> {
  FindCouponByCode(this._repository);

  final CouponRepository _repository;

  @override
  Future<Either<Failure, Coupon?>> call(String code) =>
      _repository.findByCode(code);
}
