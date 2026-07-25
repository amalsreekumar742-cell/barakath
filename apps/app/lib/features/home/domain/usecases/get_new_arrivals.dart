import 'package:dartz/dartz.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../../../products/domain/entities/product.dart';
import '../repositories/home_repository.dart';
import 'home_limit.dart';

/// Newest arrivals first (spec §2.6 "New Arrivals" + "See all").
@injectable
class GetNewArrivals implements UseCase<List<Product>, HomeLimit> {
  GetNewArrivals(this._repository);

  final HomeRepository _repository;

  @override
  Future<Either<Failure, List<Product>>> call(HomeLimit params) =>
      _repository.getNewArrivals(limit: params.limit);
}
