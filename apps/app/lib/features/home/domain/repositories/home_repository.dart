import 'package:dartz/dartz.dart';

import '../../../../core/error/failures.dart';
import '../../../categories/domain/entities/category.dart';
import '../../../products/domain/entities/product.dart';
import '../../../products/domain/entities/variant.dart';
import '../entities/banner_item.dart';

/// Home screen contract (spec §2.6). Each read is independently fallible so the
/// provider can still render the sections that succeeded.
abstract class HomeRepository {
  Future<Either<Failure, List<BannerItem>>> getBanners({int limit});

  Future<Either<Failure, List<Category>>> getCategories({int limit});

  Future<Either<Failure, List<Product>>> getFlashSaleProducts({int limit});

  Future<Either<Failure, List<Product>>> getNewArrivals({int limit});

  Future<Either<Failure, List<Product>>> getFeaturedProducts({int limit});

  /// The newest Active products in one category — one home row per category.
  Future<Either<Failure, List<Product>>> getProductsByCategory({
    required String categoryId,
    int limit,
  });

  /// Soonest live flash-sale deadline, for the countdown; `null` when idle.
  Future<Either<Failure, DateTime?>> getFlashSaleEndDate();

  /// First variant per product id — the price/image source for product cards.
  Future<Either<Failure, Map<String, Variant>>> getFirstVariants(
    Iterable<String> productIds,
  );
}
