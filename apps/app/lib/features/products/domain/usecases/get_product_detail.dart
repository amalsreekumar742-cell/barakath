import 'package:dartz/dartz.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../entities/product.dart';
import '../repositories/product_detail_repository.dart';

/// Load a single product document for the detail screen.
@injectable
class GetProductDetail implements UseCase<Product, String> {
  GetProductDetail(this._repository);

  final ProductDetailRepository _repository;

  @override
  Future<Either<Failure, Product>> call(String productId) =>
      _repository.getProduct(productId);
}
