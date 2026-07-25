import 'package:equatable/equatable.dart';

/// A product variant document (`products/{id}/variants/{variantId}`).
///
/// Per-variant pricing (spec §1.5): MRP ≥ Offer ≥ Referral ≥ Commission.
/// The fixed affiliate commission is stored under the key `commission`.
/// `flashSalePrice` is only present on a variant while its product is in an
/// active flash sale (added/removed at the sale window edges).
class Variant extends Equatable {
  final String id;
  final String name;
  final String color;
  final String colorCode;
  final double mrp;
  final double offerPrice;
  final double referralPrice;

  /// Fixed affiliate commission (Firestore key: `commission`).
  final double commission;

  /// Present only during an active flash sale, else null.
  final double? flashSalePrice;
  final int stock;

  /// Not part of the shared schema (images live on the product) — defaults to
  /// [] but read if present. See report.
  final List<String> images;
  final DateTime? createdAt;

  const Variant({
    required this.id,
    required this.name,
    required this.color,
    required this.colorCode,
    required this.mrp,
    required this.offerPrice,
    required this.referralPrice,
    required this.commission,
    required this.flashSalePrice,
    required this.stock,
    required this.images,
    required this.createdAt,
  });

  /// Alias getter for the fixed affiliate commission.
  double get affiliateCommission => commission;

  /// The price a customer actually pays: flash-sale price when live, else offer.
  double get effectivePrice => flashSalePrice ?? offerPrice;

  /// Discount % of the effective price vs. MRP (0 when MRP is missing/lower).
  double get discountPercentage {
    if (mrp <= 0 || effectivePrice >= mrp) return 0;
    return ((mrp - effectivePrice) / mrp) * 100;
  }

  bool get inStock => stock > 0;

  @override
  List<Object?> get props => [
        id,
        name,
        color,
        colorCode,
        mrp,
        offerPrice,
        referralPrice,
        commission,
        flashSalePrice,
        stock,
        images,
        createdAt,
      ];
}
