import 'package:dartz/dartz.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/error/exceptions.dart';
import '../../../../core/error/failures.dart';
import '../../../reviews/domain/entities/review.dart';
import '../../domain/entities/product.dart';
import '../../domain/entities/variant.dart';
import '../../domain/repositories/product_detail_repository.dart';
import '../datasources/product_detail_remote_datasource.dart';

/// Catches the detail datasource's exceptions and returns `Either<Failure, T>`
/// — no exception escapes into the domain/presentation layers.
@LazySingleton(as: ProductDetailRepository)
class ProductDetailRepositoryImpl implements ProductDetailRepository {
  ProductDetailRepositoryImpl(this._remote);

  final ProductDetailRemoteDataSource _remote;

  @override
  Future<Either<Failure, Product>> getProduct(String productId) async {
    try {
      return Right(await _remote.getProduct(productId));
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } catch (_) {
      return const Left(ServerFailure());
    }
  }

  @override
  Future<Either<Failure, List<Variant>>> getVariants(String productId) async {
    try {
      return Right(await _remote.getVariants(productId));
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } catch (_) {
      return const Left(ServerFailure());
    }
  }

  @override
  Future<Either<Failure, List<BundleItem>>> getBundleProducts(
    List<String> productIds,
  ) async {
    try {
      final rows = await _remote.getBundleProducts(productIds);
      return Right([
        for (final (product, variant) in rows)
          BundleItem(product: product, variant: variant),
      ]);
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } catch (_) {
      return const Left(ServerFailure());
    }
  }

  @override
  Future<Either<Failure, List<Review>>> getRecentReviews(
    String productId, {
    int limit = 3,
  }) async {
    try {
      return Right(await _remote.getRecentReviews(productId, limit: limit));
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } catch (_) {
      return const Left(ServerFailure());
    }
  }
}
