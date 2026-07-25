import 'package:dartz/dartz.dart';

import '../../../../core/error/failures.dart';
import '../entities/search_results.dart';

/// Product search + the on-device recent-search history.
abstract class SearchRepository {
  /// One page of products matching [query]. Pass the previous page's
  /// `nextCursor` as [startAfter] to page; `null` starts from the top.
  Future<Either<Failure, SearchResults>> searchProducts({
    required String query,
    required int limit,
    Object? startAfter,
  });

  /// Recent terms, newest first.
  Future<Either<Failure, List<String>>> getRecentSearches();

  /// Record [term] as the newest search; returns the updated list.
  Future<Either<Failure, List<String>>> addRecentSearch(String term);

  /// Drop a single [term]; returns the updated list.
  Future<Either<Failure, List<String>>> removeRecentSearch(String term);

  /// Wipe the whole history.
  Future<Either<Failure, Unit>> clearRecentSearches();
}
