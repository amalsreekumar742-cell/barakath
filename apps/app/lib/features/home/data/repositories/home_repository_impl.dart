import 'package:dartz/dartz.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/error/exceptions.dart';
import '../../../../core/error/failures.dart';
import '../../../categories/domain/entities/category.dart';
import '../../../products/domain/entities/product.dart';
import '../../../products/domain/entities/variant.dart';
import '../../domain/entities/banner_item.dart';
import '../../domain/repositories/home_repository.dart';
import '../datasources/home_remote_datasource.dart';

/// Catches the datasource's exceptions and returns `Either<Failure, T>`.
@LazySingleton(as: HomeRepository)
class HomeRepositoryImpl implements HomeRepository {
  HomeRepositoryImpl(this._remote);

  final HomeRemoteDataSource _remote;

  @override
  Future<Either<Failure, List<BannerItem>>> getBanners({int limit = 6}) =>
      _guard(() => _remote.getBanners(limit: limit));

  @override
  Future<Either<Failure, List<Category>>> getCategories({int limit = 10}) =>
      _guard(() => _remote.getCategories(limit: limit));

  @override
  Future<Either<Failure, List<Product>>> getFlashSaleProducts({int limit = 6}) =>
      _guard(() => _remote.getFlashSaleProducts(limit: limit));

  @override
  Future<Either<Failure, List<Product>>> getNewArrivals({int limit = 6}) =>
      _guard(() => _remote.getNewArrivals(limit: limit));

  @override
  Future<Either<Failure, List<Product>>> getFeaturedProducts({int limit = 6}) =>
      _guard(() => _remote.getFeaturedProducts(limit: limit));

  @override
  Future<Either<Failure, List<Product>>> getProductsByCategory({
    required String categoryId,
    int limit = 6,
  }) =>
      _guard(
        () => _remote.getProductsByCategory(categoryId: categoryId, limit: limit),
      );

  @override
  Future<Either<Failure, DateTime?>> getFlashSaleEndDate() =>
      _guard(_remote.getFlashSaleEndDate);

  @override
  Future<Either<Failure, Map<String, Variant>>> getFirstVariants(
    Iterable<String> productIds,
  ) =>
      _guard(() => _remote.getFirstVariants(productIds));

  /// Every home read is the same shape — fetch, or convert the exception — so
  /// the try/catch lives once instead of seven times.
  Future<Either<Failure, T>> _guard<T>(Future<T> Function() read) async {
    try {
      return Right(await read());
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } catch (_) {
      return const Left(ServerFailure());
    }
  }
}
