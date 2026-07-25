import 'package:equatable/equatable.dart';

/// The order-line snapshot the Write Review screen renders in its header.
///
/// WHY a snapshot and not the live product: spec §2.24 rates *the purchase*.
/// The customer bought a specific variant at a specific moment; if the merchant
/// later renames the product or retires the variant, the review must still say
/// what was actually reviewed. `orders/{id}.items[]` already carries that
/// snapshot, so this entity is a projection of one item of it — no read of
/// `products` is needed at all.
class ReviewableItem extends Equatable {
  const ReviewableItem({
    required this.orderId,
    required this.productId,
    required this.productName,
    required this.productImage,
    required this.variantId,
    required this.variantName,
    required this.customerName,
    required this.isDelivered,
    required this.deliveredAt,
  });

  final String orderId;
  final String productId;
  final String productName;
  final String productImage;
  final String variantId;
  final String variantName;

  /// `orders.userName` — the name snapshot stored on the review, so a later
  /// profile rename doesn't silently rewrite history on the product page.
  final String customerName;

  /// Only a Delivered order may be reviewed (spec §2.24).
  final bool isDelivered;

  /// When the order reached `Delivered`, from its status timeline. Null when the
  /// timeline has no Delivered entry — the header then omits the date rather
  /// than inventing one.
  final DateTime? deliveredAt;

  @override
  List<Object?> get props => [
        orderId,
        productId,
        productName,
        productImage,
        variantId,
        variantName,
        customerName,
        isDelivered,
        deliveredAt,
      ];
}
