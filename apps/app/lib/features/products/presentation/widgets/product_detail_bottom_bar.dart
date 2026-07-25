import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/widgets/app_toast.dart';
import '../../../../core/widgets/custom_button.dart';
import '../../../wishlist/presentation/providers/wishlist_provider.dart';

/// The sticky purchase bar (Figma node 46:6173): a wishlist square and one
/// full-width action.
///
/// The action is stateful — it reads "Add to bag · ₹price" until the selected
/// variant is in the bag, then becomes "Go to Cart". Tapping it a second time
/// opens the bag rather than adding a duplicate line, which is what the
/// customer means by tapping an already-added button.
///
/// When the variant is sold out the button states the reason instead of
/// silently doing nothing on tap.
class ProductDetailBottomBar extends StatelessWidget {
  const ProductDetailBottomBar({
    super.key,
    required this.isOutOfStock,
    required this.isInCart,
    required this.price,
    required this.productId,
    required this.onAddToCart,
  });

  final bool isOutOfStock;

  /// Is the CURRENTLY SELECTED variant already in the bag? Variant-level, so
  /// switching to a size you haven't added offers "Add to bag" again.
  final bool isInCart;
  final double price;
  final String productId;
  final VoidCallback onAddToCart;

  String get _label {
    if (isOutOfStock) return 'Out of Stock';
    if (isInCart) return 'Go to Cart';
    return 'Add to bag · ₹${price.toStringAsFixed(0)}';
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.surface,
        border: Border(top: BorderSide(color: AppColors.hairline)),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 12),
          child: Row(
            children: [
              _WishlistSquare(productId: productId),
              const SizedBox(width: 12),
              Expanded(
                child: CustomButton(
                  label: _label,
                  isDisabled: isOutOfStock,
                  onPressed:
                      isInCart ? () => context.go('/bag') : onAddToCart,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The bordered heart to the left of the action (Figma node 46:6173).
class _WishlistSquare extends StatelessWidget {
  const _WishlistSquare({required this.productId});

  final String productId;

  @override
  Widget build(BuildContext context) {
    final WishlistProvider wishlist;
    try {
      wishlist = context.watch<WishlistProvider>();
    } catch (_) {
      return const SizedBox.shrink();
    }
    final saved = wishlist.isWishlisted(productId);

    return GestureDetector(
      onTap: () async {
        final error = await wishlist.toggle(productId);
        if (!context.mounted) return;
        if (error != null) {
          AppToast.error(context, error);
        } else {
          AppToast.success(context, saved ? 'Removed from wishlist' : 'Added to wishlist');
        }
      },
      behavior: HitTestBehavior.opaque,
      child: Container(
        width: 54,
        height: 54,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: AppColors.hairline),
        ),
        child: Icon(
          saved ? Icons.favorite : Icons.favorite_border,
          size: 22,
          color: saved ? AppColors.statusError : AppColors.textPrimary,
        ),
      ),
    );
  }
}
