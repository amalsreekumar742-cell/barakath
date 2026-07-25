import 'package:dartz/dartz.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../repositories/search_repository.dart';

/// Record a term at the top of the recent-search history (deduped, capped).
/// Returns the updated list so the caller doesn't need a second read.
@injectable
class AddRecentSearch implements UseCase<List<String>, String> {
  AddRecentSearch(this._repository);

  final SearchRepository _repository;

  @override
  Future<Either<Failure, List<String>>> call(String params) =>
      _repository.addRecentSearch(params);
}
