import 'package:dartz/dartz.dart';

import '../../../../core/error/failures.dart';
import '../entities/coupon.dart';

abstract class CouponRepository {
  Future<Either<Failure, List<Coupon>>> fetchActive({int limit});

  /// Null on the Right side means "no coupon with that code" — a normal answer,
  /// not a failure.
  Future<Either<Failure, Coupon?>> findByCode(String code);
}
