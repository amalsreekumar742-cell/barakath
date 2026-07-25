import 'package:dartz/dartz.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../repositories/search_repository.dart';

/// The customer's recent search terms, newest first.
@injectable
class GetRecentSearches implements UseCase<List<String>, NoParams> {
  GetRecentSearches(this._repository);

  final SearchRepository _repository;

  @override
  Future<Either<Failure, List<String>>> call(NoParams params) =>
      _repository.getRecentSearches();
}
