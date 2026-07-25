import 'package:dartz/dartz.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/error/exceptions.dart';
import '../../../../core/error/failures.dart';
import '../../domain/repositories/notification_repository.dart';
import '../datasources/notification_local_datasource.dart';
import '../datasources/notification_remote_datasource.dart';

/// Converts both datasources' exceptions into `Either<Failure, T>`.
@LazySingleton(as: NotificationRepository)
class NotificationRepositoryImpl implements NotificationRepository {
  NotificationRepositoryImpl(this._remote, this._local);

  final NotificationRemoteDataSource _remote;
  final NotificationLocalDataSource _local;

  @override
  Future<Either<Failure, NotificationPageResult>> getBroadcasts({
    required int limit,
    Object? startAfter,
  }) async {
    try {
      final page = await _remote.getBroadcasts(limit: limit, startAfter: startAfter);
      return Right(_toResult(page));
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } catch (_) {
      return const Left(ServerFailure());
    }
  }

  @override
  Future<Either<Failure, NotificationPageResult>> getPersonal({
    required int limit,
    Object? startAfter,
  }) async {
    try {
      final page = await _remote.getPersonal(limit: limit, startAfter: startAfter);
      return Right(_toResult(page));
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } catch (_) {
      return const Left(ServerFailure());
    }
  }

  NotificationPageResult _toResult(NotificationPageDto page) =>
      NotificationPageResult(
        items: page.items,
        nextCursor: page.nextCursor,
        hasMore: page.hasMore,
      );

  @override
  Future<Either<Failure, Set<String>>> getReadIds() async {
    try {
      return Right(_local.getReadIds());
    } on CacheException catch (e) {
      return Left(CacheFailure(e.message));
    } catch (_) {
      return const Left(CacheFailure());
    }
  }

  @override
  Future<Either<Failure, Set<String>>> markRead(String notificationId) async {
    try {
      return Right(await _local.markRead(notificationId));
    } on CacheException catch (e) {
      return Left(CacheFailure(e.message));
    } catch (_) {
      return const Left(CacheFailure());
    }
  }

  @override
  Future<Either<Failure, Set<String>>> markAllRead(Iterable<String> ids) async {
    try {
      return Right(await _local.markAllRead(ids));
    } on CacheException catch (e) {
      return Left(CacheFailure(e.message));
    } catch (_) {
      return const Left(CacheFailure());
    }
  }
}
