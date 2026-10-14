import 'package:equatable/equatable.dart';

import 'variant_options.dart';

/// A product variant document (`products/{id}/variants/{variantId}`).
///
/// Per-variant pricing (spec §1.5): MRP ≥ Offer ≥ Referral ≥ Commission.
/// The fixed affiliate commission is stored under the key `commission`.
/// `flashSalePrice` is only present on a variant while its product is in an
/// active flash sale (added/removed at the sale window edges).
class Variant extends Equatable {
  final String id;

  /// Display label of the non-colour part. For a single-axis variant it IS the
  /// axis value (shown under "Size"); for a multi-axis one it is derived from
  /// [options] (e.g. "57 · Layer 2").
  final String name;

  /// One unit per Settings › Variables group, in group order (Size 57,
  /// Layer 2). Empty on single-axis variants — read axes through
  /// `variantAxes`, which folds that case in.
  final List<VariantOption> options;
  final String color;
  final String colorCode;
  final double mrp;
  final double offerPrice;
  final double referralPrice;

  /// Fixed affiliate commission (Firestore key: `commission`).
  final double commission;

  /// Present only during an active flash sale, else null. Raw — never price
  /// with it directly; [flashPrice] decides whether it actually applies.
  final double? flashSalePrice;
  final int stock;

  /// Not part of the shared schema (images live on the product) — defaults to
  /// [] but read if present. See report.
  final List<String> images;

  /// The admin-chosen display position (0-based, set by the ▲/▼ reorder).
  /// Null on variants written before reordering existed; those sort after the
  /// ordered ones, in `createdAt` order (the datasources apply this rule).
  final int? sortOrder;
  final DateTime? createdAt;

  const Variant({
    required this.id,
    required this.name,
    this.options = const [],
    required this.color,
    required this.colorCode,
    required this.mrp,
    required this.offerPrice,
    required this.referralPrice,
    required this.commission,
    required this.flashSalePrice,
    required this.stock,
    required this.images,
    required this.sortOrder,
    required this.createdAt,
  });

  /// Alias getter for the fixed affiliate commission.
  double get affiliateCommission => commission;

  /// The flash-sale price when it genuinely applies, else null.
  ///
  /// MUST mirror the unit-price rule in `createPaymentOrder`
  /// (functions/src/orders/createPaymentOrder.ts): that is what the customer
  /// is charged, and the app has no "your total changed" step — a figure
  /// shown here that the server disagrees with is a quoted price checkout
  /// won't honour. The flash price counts only when ALL hold:
  ///   1. [productInFlashSale] — the PRODUCT doc's `isFlashSale`. The variant
  ///      field alone can outlive the sale (cleared at the window edge, or left
  ///      behind by an in-place edit).
  ///   2. It is a real price (> 0) — a zero is "unset", never "free".
  ///   3. It is actually cheaper than [offerPrice]; a "sale" price at or above
  ///      the everyday price is ignored rather than charged.
  double? flashPrice({required bool productInFlashSale}) {
    final flash = flashSalePrice;
    if (!productInFlashSale || flash == null) return null;
    return flash > 0 && flash < offerPrice ? flash : null;
  }

  /// The unit price the customer actually pays: [flashPrice] when it applies,
  /// else the offer price. Takes the product's flag (rather than being a
  /// getter) so no caller can price a variant without it.
  double effectivePrice({required bool productInFlashSale}) =>
      flashPrice(productInFlashSale: productInFlashSale) ?? offerPrice;

  /// Discount % of [effectivePrice] vs. MRP (0 when MRP is missing/lower).
  double discountPercentage({required bool productInFlashSale}) {
    final price = effectivePrice(productInFlashSale: productInFlashSale);
    if (mrp <= 0 || price >= mrp) return 0;
    return ((mrp - price) / mrp) * 100;
  }

  bool get inStock => stock > 0;

  @override
  List<Object?> get props => [
        id,
        name,
        options,
        color,
        colorCode,
        mrp,
        offerPrice,
        referralPrice,
        commission,
        flashSalePrice,
        stock,
        images,
        sortOrder,
        createdAt,
      ];
}
