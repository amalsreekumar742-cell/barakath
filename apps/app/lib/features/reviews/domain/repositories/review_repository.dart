import 'dart:io';

import 'package:dartz/dartz.dart';

import '../../../../core/error/failures.dart';
import '../entities/review.dart';
import '../entities/reviewable_item.dart';

/// Domain contract for writing a product review (spec §2.24).
///
/// Reading published reviews for a product is NOT here — the product-detail
/// feature already owns that (`GetRecentProductReviews` →
/// `ProductDetailRepository.getRecentReviews`). Duplicating the query would give
/// the product page two sources of truth for the same list.
abstract class ReviewRepository {
  /// The order-line snapshot the review header renders.
  Future<Either<Failure, ReviewableItem>> getReviewableItem({
    required String orderId,
    required String productId,
  });

  /// True when this customer already reviewed this product on this order.
  /// Spec §2.24: one review per product per order, no edit after submit.
  Future<Either<Failure, bool>> hasExistingReview({
    required String userId,
    required String productId,
    required String orderId,
  });

  /// Creates the review (auto-published) with [photos] already uploaded, and
  /// returns the new document id.
  Future<Either<Failure, String>> submitReview({
    required Review review,
    required List<File> photos,
  });
}
