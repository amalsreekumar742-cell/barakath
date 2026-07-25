import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';

import '../../../../core/error/failures.dart';
import '../../../reviews/domain/entities/review.dart';
import '../entities/product.dart';
import '../entities/variant.dart';

/// A bundle ("frequently bought together") entry: the product plus the variant
/// used to price its tile. [variant] is null when the product has no variants
/// yet, so the tile must render without a price rather than crash.
class BundleItem extends Equatable {
  const BundleItem({required this.product, required this.variant});

  final Product product;
  final Variant? variant;

  @override
  List<Object?> get props => [product, variant];
}

/// Contract for everything the Product Detail screen reads.
///
/// Deliberately separate from the catalogue/listing repository: the detail
/// screen's reads are single-document + satellite queries, not a paginated
/// catalogue, and the two screens are owned/evolved independently.
abstract class ProductDetailRepository {
  Future<Either<Failure, Product>> getProduct(String productId);

  /// Ordered by `createdAt` ascending — the first entry is the default variant.
  Future<Either<Failure, List<Variant>>> getVariants(String productId);

  Future<Either<Failure, List<BundleItem>>> getBundleProducts(
    List<String> productIds,
  );

  Future<Either<Failure, List<Review>>> getRecentReviews(
    String productId, {
    int limit,
  });
}
