import 'package:dartz/dartz.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../entities/category.dart';
import '../repositories/category_repository.dart';

/// Fetch one category by document id — used when a screen is deep-linked with a
/// `categoryId` and has no in-memory category list to read from.
@injectable
class GetCategoryById implements UseCase<Category, String> {
  GetCategoryById(this._repository);

  final CategoryRepository _repository;

  @override
  Future<Either<Failure, Category>> call(String params) =>
      _repository.getCategoryById(params);
}
