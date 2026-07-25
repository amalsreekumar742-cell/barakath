import 'package:dartz/dartz.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../repositories/product_detail_repository.dart';

/// The "frequently bought together" products (max 5) with their first variant.
@injectable
class GetBundleProducts implements UseCase<List<BundleItem>, List<String>> {
  GetBundleProducts(this._repository);

  final ProductDetailRepository _repository;

  @override
  Future<Either<Failure, List<BundleItem>>> call(List<String> productIds) =>
      _repository.getBundleProducts(productIds);
}
