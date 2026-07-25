import 'package:equatable/equatable.dart';

/// A single line in the local shopping bag (spec §2.5) as a pure domain entity.
///
/// The cart lives entirely on-device — this entity carries only the identity and
/// quantity of a line (product/variant ids, display strings, image, quantity).
/// It deliberately stores NO price: prices are re-read live at checkout so a
/// stale cart can never lock in an outdated price.
class CartItem extends Equatable {
  const CartItem({
    required this.productId,
    required this.variantId,
    required this.productName,
    required this.variantName,
    required this.variantColor,
    required this.productImage,
    required this.quantity,
  });

  final String productId;
  final String variantId;
  final String productName;
  final String variantName;
  final String variantColor;
  final String productImage;
  final int quantity;

  CartItem copyWith({
    String? productId,
    String? variantId,
    String? productName,
    String? variantName,
    String? variantColor,
    String? productImage,
    int? quantity,
  }) {
    return CartItem(
      productId: productId ?? this.productId,
      variantId: variantId ?? this.variantId,
      productName: productName ?? this.productName,
      variantName: variantName ?? this.variantName,
      variantColor: variantColor ?? this.variantColor,
      productImage: productImage ?? this.productImage,
      quantity: quantity ?? this.quantity,
    );
  }

  @override
  List<Object?> get props => [
        productId,
        variantId,
        productName,
        variantName,
        variantColor,
        productImage,
        quantity,
      ];
}
