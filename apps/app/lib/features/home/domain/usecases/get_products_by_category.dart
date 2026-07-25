import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../../../products/domain/entities/product.dart';
import '../repositories/home_repository.dart';

/// Which category to pull a home row for, and how many products to show in it.
class CategoryProductsParams extends Equatable {
  const CategoryProductsParams({required this.categoryId, this.limit = 6});

  final String categoryId;
  final int limit;

  @override
  List<Object?> get props => [categoryId, limit];
}

/// One home row's worth of products for a single category (newest first).
///
/// The home screen calls this once PER CATEGORY, all in flight together, so the
/// section list stays one round-trip wide rather than one-per-category deep.
@injectable
class GetProductsByCategory
    implements UseCase<List<Product>, CategoryProductsParams> {
  GetProductsByCategory(this._repository);

  final HomeRepository _repository;

  @override
  Future<Either<Failure, List<Product>>> call(CategoryProductsParams params) =>
      _repository.getProductsByCategory(
        categoryId: params.categoryId,
        limit: params.limit,
      );
}
