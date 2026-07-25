import 'package:dartz/dartz.dart';

import '../../../../core/error/failures.dart';
import '../entities/cart_item.dart';

/// Domain contract for the local shopping bag. Implemented in the data layer
/// over SharedPreferences. Every method returns the resulting cart lines on the
/// `Right`, or a [Failure] on the `Left` — the presentation layer folds the
/// result and never touches persistence.
abstract class CartRepository {
  /// The current cart lines (rehydrated from storage).
  Future<Either<Failure, List<CartItem>>> getCart();

  /// Add a line. If the same product+variant is already present its quantity is
  /// incremented by the incoming quantity instead of adding a duplicate line.
  Future<Either<Failure, List<CartItem>>> addToCart(CartItem item);

  /// Remove a line entirely. No-op if the line is absent.
  Future<Either<Failure, List<CartItem>>> removeFromCart(
    String productId,
    String variantId,
  );

  /// Set the absolute quantity for a line. Removes the line when [quantity] <= 0.
  Future<Either<Failure, List<CartItem>>> updateQuantity(
    String productId,
    String variantId,
    int quantity,
  );

  /// Empty the cart (e.g. after a successful checkout).
  Future<Either<Failure, List<CartItem>>> clearCart();
}
