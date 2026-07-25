import 'package:dartz/dartz.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../../../products/domain/entities/product.dart';
import '../repositories/home_repository.dart';
import 'home_limit.dart';

/// Products currently on flash sale. Empty means the section is hidden entirely.
@injectable
class GetFlashSaleProducts implements UseCase<List<Product>, HomeLimit> {
  GetFlashSaleProducts(this._repository);

  final HomeRepository _repository;

  @override
  Future<Either<Failure, List<Product>>> call(HomeLimit params) =>
      _repository.getFlashSaleProducts(limit: params.limit);
}
