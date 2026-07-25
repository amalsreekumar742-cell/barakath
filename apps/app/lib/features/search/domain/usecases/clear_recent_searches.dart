import 'package:dartz/dartz.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../repositories/search_repository.dart';

/// Wipe the entire recent-search history.
@injectable
class ClearRecentSearches implements UseCase<Unit, NoParams> {
  ClearRecentSearches(this._repository);

  final SearchRepository _repository;

  @override
  Future<Either<Failure, Unit>> call(NoParams params) =>
      _repository.clearRecentSearches();
}
