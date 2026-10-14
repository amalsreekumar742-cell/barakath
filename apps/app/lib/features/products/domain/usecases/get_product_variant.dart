import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../entities/variant.dart';
import '../repositories/product_detail_repository.dart';

/// One variant read straight by id — `Right(null)` when it has been deleted.
///
/// For callers that already hold the id (buy again). Loading the product's
/// whole variant list and searching it (`GetProductVariants`) is capped and
/// ordered by `createdAt`, so a variant past the cap or missing that field was
/// reported as gone — and its line wrongly dropped as "out of stock".
@injectable
class GetProductVariant implements UseCase<Variant?, ProductVariantParams> {
  GetProductVariant(this._repository);

  final ProductDetailRepository _repository;

  @override
  Future<Either<Failure, Variant?>> call(ProductVariantParams params) =>
      _repository.getVariant(params.productId, params.variantId);
}

class ProductVariantParams extends Equatable {
  const ProductVariantParams({
    required this.productId,
    required this.variantId,
  });

  final String productId;
  final String variantId;

  @override
  List<Object?> get props => [productId, variantId];
}
