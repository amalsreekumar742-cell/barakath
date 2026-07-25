import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../entities/search_results.dart';
import '../repositories/search_repository.dart';

/// Fetch one page of products matching a query.
@injectable
class SearchProducts implements UseCase<SearchResults, SearchProductsParams> {
  SearchProducts(this._repository);

  final SearchRepository _repository;

  @override
  Future<Either<Failure, SearchResults>> call(SearchProductsParams params) =>
      _repository.searchProducts(
        query: params.query,
        limit: params.limit,
        startAfter: params.startAfter,
      );
}

class SearchProductsParams extends Equatable {
  const SearchProductsParams({
    required this.query,
    required this.limit,
    this.startAfter,
  });

  final String query;
  final int limit;

  /// Opaque cursor from the previous page — `null` for the first page.
  final Object? startAfter;

  @override
  List<Object?> get props => [query, limit, startAfter];
}
