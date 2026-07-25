import 'package:dartz/dartz.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/error/exceptions.dart';
import '../../../../core/error/failures.dart';
import '../../domain/repositories/wishlist_repository.dart';
import '../datasources/wishlist_remote_datasource.dart';

/// Catches the datasource's exceptions and returns `Either<Failure, T>`.
@LazySingleton(as: WishlistRepository)
class WishlistRepositoryImpl implements WishlistRepository {
  WishlistRepositoryImpl(this._remote);

  final WishlistRemoteDataSource _remote;

  @override
  Stream<List<String>> watchWishlistProductIds() =>
      _remote.watchWishlistProductIds();

  @override
  Future<Either<Failure, Unit>> addToWishlist(String productId) async {
    try {
      await _remote.addToWishlist(productId);
      return const Right(unit);
    } on AuthException catch (e) {
      return Left(AuthFailure(e.message));
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } catch (_) {
      return const Left(ServerFailure());
    }
  }

  @override
  Future<Either<Failure, Unit>> removeFromWishlist(String productId) async {
    try {
      await _remote.removeFromWishlist(productId);
      return const Right(unit);
    } on AuthException catch (e) {
      return Left(AuthFailure(e.message));
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } catch (_) {
      return const Left(ServerFailure());
    }
  }

  @override
  Future<Either<Failure, bool>> isWishlisted(String productId) async {
    try {
      return Right(await _remote.isWishlisted(productId));
    } on AuthException catch (e) {
      return Left(AuthFailure(e.message));
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } catch (_) {
      return const Left(ServerFailure());
    }
  }
}
