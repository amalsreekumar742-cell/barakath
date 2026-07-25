import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../features/auth/presentation/providers/auth_provider.dart';
import '../../features/products/domain/entities/product.dart';
import '../../features/products/domain/entities/variant.dart';
import '../../features/wishlist/presentation/providers/wishlist_provider.dart';
import '../constants/app_colors.dart';
import 'app_toast.dart';
import 'cached_image.dart';
import 'login_prompt_sheet.dart';

/// The catalogue product tile, shared by home, product listing, search and
/// wishlist. Its API is fixed so every surface renders products identically —
/// change it here, not by forking a copy into a feature folder.
///
/// Layout follows the Figma card (node 46:5383): a bordered white panel with the
/// image, a category pill and wishlist heart over it, then name, subtitle and a
/// gold price with the rating. There is deliberately NO add-to-bag button — the
/// card opens the product, where the variant is chosen before adding.
///
/// [variant] is the product's FIRST variant, which carries the price, stock and
/// images; it is nullable because a product whose variants haven't loaded yet
/// still has to render (falls back to the product's own thumbnail/price range).
class ProductCard extends StatelessWidget {
  const ProductCard({
    super.key,
    required this.product,
    this.variant,
    this.showFlashBadge = true,
    this.onTap,
  });

  final Product product;
  final Variant? variant;
  final bool showFlashBadge;

  /// Defaults to opening the product's detail page.
  final VoidCallback? onTap;

  /// The price the customer actually pays: flash-sale price when one is set,
  /// otherwise the offer price, falling back to the product's min price.
  double get _effectivePrice {
    final v = variant;
    if (v == null) return product.minPrice;
    return v.flashSalePrice ?? v.offerPrice;
  }

  /// The struck-through comparison price, or null when there's no discount.
  double? get _strikeThrough {
    final v = variant;
    if (v == null) return null;
    final original = v.flashSalePrice != null ? v.offerPrice : v.mrp;
    return original > _effectivePrice ? original : null;
  }

  /// "28% off" — the saving against [_strikeThrough], or null when there is no
  /// discount to state. Rounded, so a 27.6% saving reads as "28% off" exactly
  /// like the design; a saving that rounds to 0% is dropped rather than shown.
  String? get _discountLabel {
    final original = _strikeThrough;
    if (original == null || original <= 0) return null;
    final percent = ((original - _effectivePrice) / original * 100).round();
    return percent <= 0 ? null : '$percent% off';
  }

  /// Prefer the variant's stock — it's the unit actually being sold — and fall
  /// back to the product's server-computed roll-up when no variant is loaded.
  bool get _isOutOfStock =>
      variant != null ? !variant!.inStock : product.isOutOfStock;

  String get _imageUrl {
    final v = variant;
    if (v != null && v.images.isNotEmpty) return v.images.first;
    if (product.thumbnail.isNotEmpty) return product.thumbnail;
    return product.images.isNotEmpty ? product.images.first : '';
  }

  /// The pill over the image. Design shows the product's department; the sub
  /// category is the closest real field, with the category name as fallback.
  String get _pillLabel {
    if (product.subCategoryName.trim().isNotEmpty) {
      return product.subCategoryName;
    }
    return product.categoryName;
  }

  /// The grey line under the name ("50ml · Eau de Parfum" in the design) —
  /// built from the variant and the department, whichever exist.
  String get _subtitle {
    final parts = <String>[
      if ((variant?.name ?? '').trim().isNotEmpty) variant!.name.trim(),
      if (product.categoryName.trim().isNotEmpty) product.categoryName.trim(),
    ];
    return parts.join(' · ');
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap ?? () => context.push('/product/${product.id}'),
      behavior: HitTestBehavior.opaque,
      child: Container(
        padding: const EdgeInsets.all(11),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.hairline),
          boxShadow: const [
            BoxShadow(
              color: Color(0x0A1B1C1D),
              blurRadius: 4,
              offset: Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            SizedBox(
              height: 128,
              width: double.infinity,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  // Out-of-stock rows are dimmed rather than hidden: the customer
                  // may still want the detail page (restock, other variants).
                  Opacity(
                    opacity: _isOutOfStock ? 0.45 : 1,
                    child: CachedImage(url: _imageUrl, borderRadius: 8),
                  ),
                  if (_pillLabel.trim().isNotEmpty)
                    Positioned(top: 8, left: 8, child: _CategoryPill(_pillLabel)),
                  Positioned(
                    top: 7,
                    right: 7,
                    child: _WishlistHeart(productId: product.id),
                  ),
                  if (_isOutOfStock)
                    Align(
                      alignment: Alignment.center,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 5,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.ink.withValues(alpha: 0.75),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Text(
                          'OUT OF STOCK',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 0.04,
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 9),
            Text(
              product.name,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 14,
                height: 1.25,
                fontWeight: FontWeight.w700,
                color: AppColors.textPrimary,
              ),
            ),
            if (_subtitle.isNotEmpty) ...[
              const SizedBox(height: 2),
              Text(
                _subtitle,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 12,
                  color: AppColors.textSecondary,
                ),
              ),
            ],
            const SizedBox(height: 9),
            // The design gives the card TWO lines here, not one: the prices own
            // the first, and "28% off · ★ 4.7" share the second.
            //
            // WHY that matters beyond matching the design: when the price, the
            // struck-through price and the rating all competed for one 150px
            // row, the price was the thing that lost — "₹3,240" rendered as
            // "₹21…". Splitting the lines means neither number has to shrink.
            //
            // The price itself stays unflexed (it is the one number that must
            // never be clipped); the MRP is Flexible, so if anything still has
            // to give, it is the struck-through price.
            Row(
              crossAxisAlignment: CrossAxisAlignment.baseline,
              textBaseline: TextBaseline.alphabetic,
              children: [
                Text(
                  '₹${_effectivePrice.toStringAsFixed(0)}',
                  maxLines: 1,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                    color: AppColors.goldStrong,
                  ),
                ),
                if (_strikeThrough != null) ...[
                  const SizedBox(width: 6),
                  Flexible(
                    child: Text(
                      '₹${_strikeThrough!.toStringAsFixed(0)}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 12,
                        color: AppColors.textFaint,
                        decoration: TextDecoration.lineThrough,
                      ),
                    ),
                  ),
                ],
              ],
            ),
            if (_discountLabel != null || product.totalReviews > 0) ...[
              const SizedBox(height: 3),
              Row(
                children: [
                  if (_discountLabel != null)
                    Flexible(
                      child: Text(
                        _discountLabel!,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: AppColors.semanticSuccess,
                        ),
                      ),
                    ),
                  if (_discountLabel != null && product.totalReviews > 0)
                    const SizedBox(width: 8),
                  // Outline star in gold, number in secondary — the design's
                  // `Stars` component (StarLine 13px, label 12/600).
                  if (product.totalReviews > 0) ...[
                    const Icon(Icons.star_border_rounded,
                        size: 13, color: AppColors.gold),
                    const SizedBox(width: 3),
                    Text(
                      product.averageRating.toStringAsFixed(1),
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// The uppercase department pill over the image (Figma node 46:5386).
class _CategoryPill extends StatelessWidget {
  const _CategoryPill(this.label);

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(maxWidth: 96),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.9),
        borderRadius: BorderRadius.circular(9999),
      ),
      child: Text(
        label.toUpperCase(),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: const TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w800,
          letterSpacing: 0.3,
          color: AppColors.goldStrong,
        ),
      ),
    );
  }
}

/// The wishlist toggle in the card's top-right corner.
///
/// Guests can't have a wishlist (spec §2.4), so they get the login prompt
/// instead of a rejected write. Both providers are read defensively: this card
/// renders on every catalogue surface, and a missing provider must degrade to
/// "no heart" rather than crash a whole product grid.
class _WishlistHeart extends StatelessWidget {
  const _WishlistHeart({required this.productId});

  final String productId;

  @override
  Widget build(BuildContext context) {
    final WishlistProvider wishlist;
    try {
      wishlist = context.watch<WishlistProvider>();
    } catch (_) {
      return const SizedBox.shrink();
    }

    final isWishlisted = wishlist.isWishlisted(productId);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () => _onTap(context, wishlist),
        customBorder: const CircleBorder(),
        child: Container(
          width: 30,
          height: 30,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.9),
            shape: BoxShape.circle,
          ),
          child: Icon(
            isWishlisted ? Icons.favorite : Icons.favorite_border,
            size: 16,
            color: isWishlisted ? AppColors.statusError : AppColors.ink,
          ),
        ),
      ),
    );
  }

  Future<void> _onTap(BuildContext context, WishlistProvider wishlist) async {
    if (_isGuest(context)) {
      await showLoginPromptSheet(context);
      return;
    }
    final wasWishlisted = wishlist.isWishlisted(productId);
    final error = await wishlist.toggle(productId);
    if (!context.mounted) return;
    if (error != null) {
      AppToast.error(context, error);
    } else {
      AppToast.success(
        context,
        wasWishlisted ? 'Removed from wishlist' : 'Added to wishlist',
      );
    }
  }

  bool _isGuest(BuildContext context) {
    try {
      final auth = context.read<AuthProvider>();
      return !auth.isAuthenticated;
    } catch (_) {
      return false;
    }
  }
}
