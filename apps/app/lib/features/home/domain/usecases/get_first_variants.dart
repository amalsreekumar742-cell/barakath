import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../../../products/domain/entities/variant.dart';
import '../repositories/home_repository.dart';

/// The first variant of each product, keyed by product id.
///
/// WHY the home screen needs this at all: price, stock and images live on the
/// variant, not the product, so a card can't render a real price without one.
@injectable
class GetFirstVariants implements UseCase<Map<String, Variant>, ProductIdsParams> {
  GetFirstVariants(this._repository);

  final HomeRepository _repository;

  @override
  Future<Either<Failure, Map<String, Variant>>> call(ProductIdsParams params) =>
      _repository.getFirstVariants(params.productIds);
}

class ProductIdsParams extends Equatable {
  const ProductIdsParams(this.productIds);

  final List<String> productIds;

  @override
  List<Object?> get props => [productIds];
}
