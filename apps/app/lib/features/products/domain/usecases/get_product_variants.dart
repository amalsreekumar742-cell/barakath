import 'package:dartz/dartz.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../entities/variant.dart';
import '../repositories/product_detail_repository.dart';

/// All variants of a product, oldest-first — the first is the default selection.
@injectable
class GetProductVariants implements UseCase<List<Variant>, String> {
  GetProductVariants(this._repository);

  final ProductDetailRepository _repository;

  @override
  Future<Either<Failure, List<Variant>>> call(String productId) =>
      _repository.getVariants(productId);
}
