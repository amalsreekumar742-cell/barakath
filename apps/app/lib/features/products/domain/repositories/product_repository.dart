import 'package:dartz/dartz.dart';

import '../../../../core/error/failures.dart';
import '../entities/product.dart';
import '../entities/variant.dart';

/// The orderings offered by the listing screen's sort sheet (spec §2.9).
enum ProductSort {
  newest,
  priceLowToHigh,
  priceHighToLow,
  rating,
  popularity;

  /// Stable wire value — safe to put in a deep link or persist.
  String get value => switch (this) {
        ProductSort.newest => 'newest',
        ProductSort.priceLowToHigh => 'price_low',
        ProductSort.priceHighToLow => 'price_high',
        ProductSort.rating => 'rating',
        ProductSort.popularity => 'popular',
      };

  String get label => switch (this) {
        ProductSort.newest => 'Newest First',
        ProductSort.priceLowToHigh => 'Price: Low to High',
        ProductSort.priceHighToLow => 'Price: High to Low',
        ProductSort.rating => 'Rating',
        ProductSort.popularity => 'Popularity',
      };

  static ProductSort fromValue(String? value) => ProductSort.values.firstWhere(
        (sort) => sort.value == value,
        orElse: () => ProductSort.newest,
      );
}

/// One cursor-paginated page of products.
///
/// [nextCursor] is deliberately opaque (`Object?`): it is a Firestore
/// `DocumentSnapshot` created in — and only ever read back by — the data layer,
/// so the domain never depends on the Firestore SDK.
class ProductPageResult {
  const ProductPageResult({
    required this.items,
    required this.nextCursor,
    required this.hasMore,
  });

  final List<Product> items;
  final Object? nextCursor;
  final bool hasMore;
}

/// Domain contract for reading the catalogue's products (listing surfaces only).
abstract class ProductRepository {
  /// One page of `Active` products matching the given filters, newest-first by
  /// default. Pass [startAfter] (a previous page's `nextCursor`) to paginate.
  Future<Either<Failure, ProductPageResult>> getProducts({
    String? categoryId,
    String? subCategory,
    bool newArrivalsOnly,
    bool flashSaleOnly,
    ProductSort sortBy,
    int limit,
    Object? startAfter,
  });

  /// The FIRST variant of each product id, keyed by product id. Products with
  /// no variant are simply absent from the map.
  Future<Either<Failure, Map<String, Variant>>> getFirstVariants(List<String> productIds);
}
