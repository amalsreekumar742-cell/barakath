import 'package:equatable/equatable.dart';

import '../../../products/domain/entities/product.dart';
import '../../../products/domain/entities/variant.dart';

/// Live catalogue data for the lines currently in the bag, keyed by id.
///
/// WHY this exists: the cart is persisted locally (SharedPreferences) and stores
/// only ids, names and quantity — never price. Price, stock and availability are
/// ALWAYS re-read from Firestore when the bag opens (spec §2.10), so a price
/// change or a sold-out variant can never be paid at a stale figure.
class CartDetails extends Equatable {
  const CartDetails({required this.products, required this.variants});

  const CartDetails.empty() : products = const {}, variants = const {};

  /// productId → product.
  final Map<String, Product> products;

  /// variantId → variant.
  final Map<String, Variant> variants;

  @override
  List<Object?> get props => [products, variants];
}
