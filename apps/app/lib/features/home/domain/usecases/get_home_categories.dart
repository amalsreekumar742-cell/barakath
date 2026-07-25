import 'package:dartz/dartz.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../../../categories/domain/entities/category.dart';
import '../repositories/home_repository.dart';
import 'home_limit.dart';

/// The "Shop by category" strip — the oldest categories first, which is the
/// order the admin created (and therefore ranks) them in.
@injectable
class GetHomeCategories implements UseCase<List<Category>, HomeLimit> {
  GetHomeCategories(this._repository);

  final HomeRepository _repository;

  @override
  Future<Either<Failure, List<Category>>> call(HomeLimit params) =>
      _repository.getCategories(limit: params.limit);
}
