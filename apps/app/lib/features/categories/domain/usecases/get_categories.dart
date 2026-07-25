import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../entities/category.dart';
import '../repositories/category_repository.dart';

/// Fetch the catalogue's categories in admin display order.
@injectable
class GetCategories implements UseCase<List<Category>, GetCategoriesParams> {
  GetCategories(this._repository);

  final CategoryRepository _repository;

  @override
  Future<Either<Failure, List<Category>>> call(GetCategoriesParams params) =>
      _repository.getCategories(limit: params.limit);
}

class GetCategoriesParams extends Equatable {
  const GetCategoriesParams({this.limit = 50});

  final int limit;

  @override
  List<Object?> get props => [limit];
}
