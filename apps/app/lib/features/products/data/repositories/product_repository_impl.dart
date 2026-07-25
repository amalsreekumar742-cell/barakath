import 'package:dartz/dartz.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/error/exceptions.dart';
import '../../../../core/error/failures.dart';
import '../../domain/entities/variant.dart';
import '../../domain/repositories/product_repository.dart';
import '../datasources/product_remote_datasource.dart';

@LazySingleton(as: ProductRepository)
class ProductRepositoryImpl implements ProductRepository {
  ProductRepositoryImpl(this._remote);

  final ProductRemoteDataSource _remote;

  @override
  Future<Either<Failure, ProductPageResult>> getProducts({
    String? categoryId,
    String? subCategory,
    bool newArrivalsOnly = false,
    bool flashSaleOnly = false,
    ProductSort sortBy = ProductSort.newest,
    int limit = 10,
    Object? startAfter,
  }) async {
    try {
      final page = await _remote.getProducts(
        categoryId: categoryId,
        subCategory: subCategory,
        newArrivalsOnly: newArrivalsOnly,
        flashSaleOnly: flashSaleOnly,
        sortBy: sortBy,
        limit: limit,
        startAfter: startAfter,
      );
      return Right(
        ProductPageResult(
          items: page.items,
          // Passed straight back through as an opaque token on the next call.
          nextCursor: page.nextCursor,
          hasMore: page.hasMore,
        ),
      );
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } catch (_) {
      return const Left(ServerFailure());
    }
  }

  @override
  Future<Either<Failure, Map<String, Variant>>> getFirstVariants(
    List<String> productIds,
  ) async {
    try {
      final variants = await _remote.getFirstVariants(productIds);
      return Right(variants);
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } catch (_) {
      return const Left(ServerFailure());
    }
  }
}
