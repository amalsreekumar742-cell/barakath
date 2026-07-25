import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../repositories/product_repository.dart';

/// Fetch one cursor page of the product listing (spec §2.9).
@injectable
class GetProducts implements UseCase<ProductPageResult, GetProductsParams> {
  GetProducts(this._repository);

  final ProductRepository _repository;

  @override
  Future<Either<Failure, ProductPageResult>> call(GetProductsParams params) =>
      _repository.getProducts(
        categoryId: params.categoryId,
        subCategory: params.subCategory,
        newArrivalsOnly: params.newArrivalsOnly,
        flashSaleOnly: params.flashSaleOnly,
        sortBy: params.sortBy,
        limit: params.limit,
        startAfter: params.startAfter,
      );
}

class GetProductsParams extends Equatable {
  const GetProductsParams({
    this.categoryId,
    this.subCategory,
    this.newArrivalsOnly = false,
    this.flashSaleOnly = false,
    this.sortBy = ProductSort.newest,
    this.limit = 10,
    this.startAfter,
  });

  final String? categoryId;
  final String? subCategory;
  final bool newArrivalsOnly;
  final bool flashSaleOnly;
  final ProductSort sortBy;
  final int limit;

  /// The previous page's `nextCursor`; null for the first page.
  final Object? startAfter;

  @override
  List<Object?> get props => [
        categoryId,
        subCategory,
        newArrivalsOnly,
        flashSaleOnly,
        sortBy,
        limit,
        startAfter,
      ];
}
