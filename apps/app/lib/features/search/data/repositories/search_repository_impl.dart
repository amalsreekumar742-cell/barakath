import 'package:dartz/dartz.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/error/exceptions.dart';
import '../../../../core/error/failures.dart';
import '../../domain/entities/search_results.dart';
import '../../domain/repositories/search_repository.dart';
import '../datasources/search_local_datasource.dart';
import '../datasources/search_remote_datasource.dart';

/// Catches the datasources' exceptions and returns `Either<Failure, T>` — no
/// exception escapes past here into the domain/presentation layers.
@LazySingleton(as: SearchRepository)
class SearchRepositoryImpl implements SearchRepository {
  SearchRepositoryImpl(this._remote, this._local);

  final SearchRemoteDataSource _remote;
  final SearchLocalDataSource _local;

  @override
  Future<Either<Failure, SearchResults>> searchProducts({
    required String query,
    required int limit,
    Object? startAfter,
  }) async {
    try {
      final results = await _remote.searchProducts(
        query: query,
        limit: limit,
        startAfter: startAfter,
      );
      return Right(results);
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } catch (_) {
      return const Left(ServerFailure());
    }
  }

  @override
  Future<Either<Failure, List<String>>> getRecentSearches() async {
    try {
      return Right(_local.getRecentSearches());
    } on CacheException catch (e) {
      return Left(CacheFailure(e.message));
    } catch (_) {
      return const Left(CacheFailure());
    }
  }

  @override
  Future<Either<Failure, List<String>>> addRecentSearch(String term) async {
    try {
      return Right(await _local.addRecentSearch(term));
    } on CacheException catch (e) {
      return Left(CacheFailure(e.message));
    } catch (_) {
      return const Left(CacheFailure());
    }
  }

  @override
  Future<Either<Failure, List<String>>> removeRecentSearch(String term) async {
    try {
      return Right(await _local.removeRecentSearch(term));
    } on CacheException catch (e) {
      return Left(CacheFailure(e.message));
    } catch (_) {
      return const Left(CacheFailure());
    }
  }

  @override
  Future<Either<Failure, Unit>> clearRecentSearches() async {
    try {
      await _local.clearRecentSearches();
      return const Right(unit);
    } on CacheException catch (e) {
      return Left(CacheFailure(e.message));
    } catch (_) {
      return const Left(CacheFailure());
    }
  }
}
