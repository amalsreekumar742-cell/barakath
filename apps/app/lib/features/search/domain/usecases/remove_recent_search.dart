import 'package:dartz/dartz.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../repositories/search_repository.dart';

/// Drop one term from the recent-search history; returns the updated list.
@injectable
class RemoveRecentSearch implements UseCase<List<String>, String> {
  RemoveRecentSearch(this._repository);

  final SearchRepository _repository;

  @override
  Future<Either<Failure, List<String>>> call(String params) =>
      _repository.removeRecentSearch(params);
}
