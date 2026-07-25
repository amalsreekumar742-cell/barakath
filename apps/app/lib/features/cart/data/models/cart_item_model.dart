import '../../domain/entities/cart_item.dart';

/// Data model for a cart line — extends the [CartItem] entity and adds local
/// (SharedPreferences) JSON (de)serialization. NOT a Firestore document, hence
/// [toJson] / [fromJson] rather than a Firestore converter.
///
/// The persisted JSON shape is unchanged from the pre-refactor model so an
/// existing on-device cart still loads. Deliberately stores NO price.
class CartItemModel extends CartItem {
  const CartItemModel({
    required super.productId,
    required super.variantId,
    required super.productName,
    required super.variantName,
    required super.variantColor,
    required super.productImage,
    required super.quantity,
  });

  /// Promote a domain [CartItem] to a persistable model.
  factory CartItemModel.fromEntity(CartItem item) => CartItemModel(
        productId: item.productId,
        variantId: item.variantId,
        productName: item.productName,
        variantName: item.variantName,
        variantColor: item.variantColor,
        productImage: item.productImage,
        quantity: item.quantity,
      );

  factory CartItemModel.fromJson(Map<String, dynamic> json) {
    return CartItemModel(
      productId: (json['productId'] ?? '').toString(),
      variantId: (json['variantId'] ?? '').toString(),
      productName: (json['productName'] ?? '').toString(),
      variantName: (json['variantName'] ?? '').toString(),
      variantColor: (json['variantColor'] ?? '').toString(),
      productImage: (json['productImage'] ?? '').toString(),
      quantity: (json['quantity'] is num)
          ? (json['quantity'] as num).toInt()
          : int.tryParse('${json['quantity']}') ?? 1,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'productId': productId,
      'variantId': variantId,
      'productName': productName,
      'variantName': variantName,
      'variantColor': variantColor,
      'productImage': productImage,
      'quantity': quantity,
    };
  }

  @override
  CartItemModel copyWith({
    String? productId,
    String? variantId,
    String? productName,
    String? variantName,
    String? variantColor,
    String? productImage,
    int? quantity,
  }) {
    return CartItemModel(
      productId: productId ?? this.productId,
      variantId: variantId ?? this.variantId,
      productName: productName ?? this.productName,
      variantName: variantName ?? this.variantName,
      variantColor: variantColor ?? this.variantColor,
      productImage: productImage ?? this.productImage,
      quantity: quantity ?? this.quantity,
    );
  }
}
