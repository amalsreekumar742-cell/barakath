import 'package:dartz/dartz.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../../../products/domain/entities/product.dart';
import '../repositories/home_repository.dart';
import 'home_limit.dart';

/// The best-rated active products, shown as the home grid.
@injectable
class GetFeaturedProducts implements UseCase<List<Product>, HomeLimit> {
  GetFeaturedProducts(this._repository);

  final HomeRepository _repository;

  @override
  Future<Either<Failure, List<Product>>> call(HomeLimit params) =>
      _repository.getFeaturedProducts(limit: params.limit);
}
