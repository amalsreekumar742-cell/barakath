import 'package:flutter/material.dart';

import '../../../../core/widgets/product_card.dart';
import '../../../products/domain/entities/product.dart';
import '../../../products/domain/entities/variant.dart';

/// A horizontally scrolling row of [ProductCard]s (flash sale, new arrivals).
///
/// Card width is fixed at 150 to match the design; the row's height is derived
/// from it rather than hardcoded so a long product name can't clip.
class ProductRow extends StatelessWidget {
  const ProductRow({
    super.key,
    required this.products,
    required this.variants,
    this.showFlashBadge = true,
    this.padding = const EdgeInsets.symmetric(horizontal: 16),
  });

  final List<Product> products;

  /// First variant per product id — supplies price, stock and image.
  final Map<String, Variant> variants;

  final bool showFlashBadge;
  final EdgeInsetsGeometry padding;

  static const double _cardWidth = 150;

  @override
  Widget build(BuildContext context) {
    if (products.isEmpty) return const SizedBox.shrink();

    return SizedBox(
      // Card padding + 128px image + name + subtitle + the price line + the
      // "% off · rating" line beneath it. Keep this in step with the grid's
      // `mainAxisExtent` on home — both render the same ProductCard, so a card
      // that fits one and overflows the other is the bug this number prevents.
      height: 256,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: padding,
        itemCount: products.length,
        separatorBuilder: (_, __) => const SizedBox(width: 12),
        itemBuilder: (_, index) {
          final product = products[index];
          return SizedBox(
            width: _cardWidth,
            child: ProductCard(
              product: product,
              variant: variants[product.id],
              showFlashBadge: showFlashBadge,
            ),
          );
        },
      ),
    );
  }
}
