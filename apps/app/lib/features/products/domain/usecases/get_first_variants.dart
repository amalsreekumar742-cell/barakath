import 'package:dartz/dartz.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../entities/variant.dart';
import '../repositories/product_repository.dart';

/// Fetch the FIRST variant of each product in a listing page — the product card
/// renders price, discount and stock from it (they live on the variant, not on
/// the product doc).
@injectable
class GetFirstVariants implements UseCase<Map<String, Variant>, List<String>> {
  GetFirstVariants(this._repository);

  final ProductRepository _repository;

  @override
  Future<Either<Failure, Map<String, Variant>>> call(List<String> params) =>
      _repository.getFirstVariants(params);
}
