import 'package:dartz/dartz.dart';

import '../../../../core/error/failures.dart';

/// Wishlist contract (spec §2.21 "Wishlist"), stored per customer at
/// `users/{uid}/wishlist/{productId}`.
///
/// The wishlist is modelled as a set of product ids rather than full products:
/// every catalogue surface only needs "is this product hearted?", and the
/// product data it would duplicate is already loaded by whatever list is on
/// screen. The wishlist *page* re-reads the products by id.
abstract class WishlistRepository {
  /// Live product ids in the signed-in customer's wishlist. Emits `[]` while
  /// signed out, so a sign-out clears every heart without extra wiring.
  Stream<List<String>> watchWishlistProductIds();

  Future<Either<Failure, Unit>> addToWishlist(String productId);

  Future<Either<Failure, Unit>> removeFromWishlist(String productId);

  Future<Either<Failure, bool>> isWishlisted(String productId);
}
