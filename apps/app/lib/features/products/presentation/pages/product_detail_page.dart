import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:youtube_player_flutter/youtube_player_flutter.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_details.dart';
import '../../../../core/constants/app_dimens.dart';
import '../../../../core/di/injection_container.dart';
import '../../../../core/widgets/app_toast.dart';
import '../../../../core/widgets/circle_back_button.dart';
import '../../../../core/widgets/error_state.dart';
import '../../../../core/widgets/image_viewer.dart';
import '../../../../core/widgets/login_prompt_sheet.dart';
import '../../../../core/widgets/price_display.dart';
import '../../../../core/widgets/product_card.dart';
import '../../../auth/presentation/providers/auth_provider.dart';
import '../../../wishlist/presentation/providers/wishlist_provider.dart';
import '../../../cart/domain/entities/cart_item.dart';
import '../../../cart/presentation/providers/cart_provider.dart';
import '../../domain/entities/variant.dart';
import '../../domain/repositories/product_detail_repository.dart';
import '../providers/product_detail_provider.dart';
import '../widgets/product_detail_bottom_bar.dart';
import '../widgets/product_detail_bundle_section.dart';
import '../widgets/product_detail_description.dart';
import '../widgets/product_detail_gallery.dart';
import '../widgets/product_detail_reviews_section.dart';
import '../widgets/product_detail_shimmer.dart';
import '../widgets/product_detail_specifications.dart';
import '../widgets/product_detail_variant_selector.dart';

/// Product Detail screen (spec §2.10).
///
/// WHY the provider is page-scoped rather than app-wide: the screen is
/// re-entrant — a bundle tile pushes another product detail on top of this one —
/// so each route needs its own state. `ChangeNotifierProvider` also disposes the
/// instance (and with it the YouTube controller further down the tree) on pop.
class ProductDetailPage extends StatelessWidget {
  const ProductDetailPage({super.key, required this.productId});

  final String productId;

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider<ProductDetailProvider>(
      create: (_) =>
          sl<ProductDetailProvider>()..fetchProductDetail(productId),
      child: _ProductDetailView(productId: productId),
    );
  }
}

class _ProductDetailView extends StatefulWidget {
  const _ProductDetailView({required this.productId});

  final String productId;

  @override
  State<_ProductDetailView> createState() => _ProductDetailViewState();
}

class _ProductDetailViewState extends State<_ProductDetailView> {
  /// The gallery's video player, owned HERE rather than inside the gallery.
  ///
  /// WHY this high up: fullscreen is [YoutubePlayerBuilder]'s job, and it works
  /// by rendering the player ALONE in landscape and the page content only in
  /// portrait. It therefore has to sit above everything the fullscreen video
  /// should replace — the whole Scaffold. Created lazily on the first tap of
  /// the play button, so a product page that is never scrolled to the video
  /// never pays for a platform WebView.
  YoutubePlayerController? _videoController;

  void _playVideo(String videoId) {
    if (_videoController != null) return;
    setState(() {
      _videoController = YoutubePlayerController(
        initialVideoId: videoId,
        // autoPlay: this only ever runs from an explicit tap on the play button.
        flags: const YoutubePlayerFlags(autoPlay: true, mute: false),
      );
    });
  }

  @override
  void dispose() {
    _videoController?.dispose();
    super.dispose();
  }

  /// Guests have no wishlist (spec §2.4) — prompt to sign in rather than firing
  /// a write the rules will reject.
  Future<void> _toggleWishlist() async {
    if (!context.read<AuthProvider>().isAuthenticated) {
      showLoginPromptSheet(context);
      return;
    }
    final error = await context.read<WishlistProvider>().toggle(widget.productId);
    if (!mounted || error == null) return;
    AppToast.error(context, error);
  }

  void _share(String productName) {
    Share.share(
      '$productName — ${AppDetails.appName}\n${AppDetails.playStoreLink}',
    );
  }

  /// Reports a colour/size tap that landed on a sold-out variant. Null means the
  /// product carries no variant for that value at all, which the selector cannot
  /// produce — it only ever offers values read off the variants themselves.
  void _warnIfSoldOut(Variant? variant) {
    if (variant == null || variant.stock > 0) return;
    AppToast.error(context, 'This option is out of stock');
  }

  /// Adds the SELECTED variant. Guests are prompted to log in first; an
  /// already-present line is reported instead of silently duplicated (spec:
  /// quantity is adjusted from the Bag, not from here).
  ///
  /// Returns true when the item is in the cart afterwards, so "Buy Now" only
  /// routes on when there is actually something to check out.
  bool _addToCart() {
    final auth = context.read<AuthProvider>();
    if (!auth.isAuthenticated) {
      showLoginPromptSheet(context);
      return false;
    }

    final detail = context.read<ProductDetailProvider>();
    final product = detail.product;
    final variant = detail.selectedVariant;
    if (product == null || variant == null) return false;
    if (!detail.isInStock) {
      AppToast.error(context, 'This variant is out of stock');
      return false;
    }

    final cart = context.read<CartProvider>();
    final already = cart.items.any(
      (line) => line.productId == product.id && line.variantId == variant.id,
    );
    if (already) {
      AppToast.info(context, 'Already in cart');
      return true;
    }

    final images = detail.galleryImages;
    cart.addToCart(
      CartItem(
        productId: product.id,
        variantId: variant.id,
        productName: product.name,
        variantName: variant.name,
        variantColor: variant.color,
        productImage: images.isNotEmpty ? images.first : product.thumbnail,
        quantity: 1,
      ),
    );
    AppToast.success(context, 'Added to cart');
    return true;
  }

  /// Adds every ticked row of "Frequently bought together" in one go.
  ///
  /// Rows that cannot be added are skipped rather than aborting the batch — a
  /// single out-of-stock partner must not stop the other three from landing in
  /// the cart — and the toast reports what actually happened.
  void _addBundleToCart(List<BundleItem> selected) {
    if (!context.read<AuthProvider>().isAuthenticated) {
      showLoginPromptSheet(context);
      return;
    }

    final cart = context.read<CartProvider>();
    var added = 0;
    var skipped = 0;

    for (final item in selected) {
      final variant = item.variant;
      if (variant == null || !variant.inStock) {
        skipped++;
        continue;
      }
      if (cart.containsVariant(item.product.id, variant.id)) continue;

      cart.addToCart(
        CartItem(
          productId: item.product.id,
          variantId: variant.id,
          productName: item.product.name,
          variantName: variant.name,
          variantColor: variant.color,
          productImage: item.product.thumbnail,
          quantity: 1,
        ),
      );
      added++;
    }

    if (added == 0) {
      AppToast.info(
        context,
        skipped > 0
            ? 'Those items are out of stock'
            : 'Already in cart',
      );
      return;
    }
    AppToast.success(
      context,
      skipped == 0
          ? 'Added $added ${added == 1 ? 'item' : 'items'} to cart'
          : 'Added $added, skipped $skipped out of stock',
    );
  }


  @override
  Widget build(BuildContext context) {
    final detail = context.watch<ProductDetailProvider>();
    final videoController = _videoController;

    // Before the play button is tapped there is no player, so the page is built
    // straight. Once there is one, YoutubePlayerBuilder wraps EVERYTHING: in
    // landscape it renders the player alone, which is what makes fullscreen
    // show only the video instead of the whole product page behind it.
    if (videoController == null) return _buildScaffold(detail, null);

    return YoutubePlayerBuilder(
      player: YoutubePlayer(
        controller: videoController,
        showVideoProgressIndicator: true,
        progressIndicatorColor: AppColors.cta,
      ),
      builder: (context, player) => _buildScaffold(detail, player),
    );
  }

  Widget _buildScaffold(ProductDetailProvider detail, Widget? videoPlayer) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: Stack(
        children: [
          Positioned.fill(child: _buildBody(detail, videoPlayer)),
          Positioned(
            top: MediaQuery.paddingOf(context).top + 8,
            left: 12,
            child: const CircleBackButton(style: CircleBackStyle.onImage),
          ),
        ],
      ),
      bottomNavigationBar: detail.status == ProductDetailStatus.loaded
          ? ProductDetailBottomBar(
              isOutOfStock: !detail.isInStock,
              isInCart: context.watch<CartProvider>().containsVariant(
                    detail.product?.id ?? '',
                    detail.selectedVariant?.id ?? '',
                  ),
              price: detail.selectedVariant?.effectivePrice ??
                  detail.product?.minPrice ??
                  0,
              productId: detail.product?.id ?? '',
              onAddToCart: _addToCart,
            )
          : null,
    );
  }

  Widget _buildBody(ProductDetailProvider detail, Widget? videoPlayer) {
    switch (detail.status) {
      case ProductDetailStatus.initial:
      case ProductDetailStatus.loading:
        return const ProductDetailShimmer();
      case ProductDetailStatus.error:
        return ErrorState(
          message: detail.errorMessage,
          onRetry: () => detail.fetchProductDetail(widget.productId),
        );
      case ProductDetailStatus.loaded:
        return _buildContent(detail, videoPlayer);
    }
  }

  Widget _buildContent(ProductDetailProvider detail, Widget? videoPlayer) {
    final product = detail.product!;
    final images = detail.galleryImages;

    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ProductDetailGallery(
            images: images,
            // Rides as the last page of the carousel, after every image.
            videoUrl: product.youtubeVideoLink,
            videoPlayer: videoPlayer,
            videoController: _videoController,
            onPlayVideo: _playVideo,
            selectedIndex: detail.selectedImageIndex,
            onIndexChanged: detail.selectImage,
            onImageTap: (index) => showImageViewer(
              context,
              images: images,
              initialIndex: index,
            ),
            onShare: () => _share(product.name),
            onWishlistToggle: _toggleWishlist,
            isWishlisted:
                context.watch<WishlistProvider>().isWishlisted(widget.productId),
            showSaleBadge: product.isFlashSale,
          ),
          const SizedBox(height: 16),
          _buildInfo(detail),
          _AffiliateBanner(variant: detail.selectedVariant),
          const SizedBox(height: 20),
          if (detail.variants.isNotEmpty) ...[
            ProductDetailVariantSelector(
              colorOptions: detail.colorOptions,
              sizeOptions: detail.sizeOptions,
              selectedColor: detail.selectedColor,
              selectedSize: detail.selectedSize,
              // A tap always lands on a real variant, but that variant may be
              // sold out — say so rather than leaving the shopper to notice the
              // disabled Add-to-bag button on their own.
              onSelectColor: (color) => _warnIfSoldOut(detail.selectColor(color)),
              onSelectSize: (size) => _warnIfSoldOut(detail.selectSize(size)),
            ),
            const SizedBox(height: 20),
          ],
          if (product.isCombo && detail.bundleItems.isNotEmpty) ...[
            ProductDetailBundleSection(
              currentItem: BundleItem(
                product: product,
                variant: detail.selectedVariant,
              ),
              items: detail.bundleItems,
              comboDeliveryCharge: product.comboDeliveryCharge,
              // Push (not go) so the shopper can walk back up the bundle chain.
              onItemTap: (id) => context.push('/product/$id'),
              onAddSelected: _addBundleToCart,
            ),
            const SizedBox(height: 20),
          ],
          ProductDetailDescription(description: product.description),
          if (product.description.trim().isNotEmpty)
            const SizedBox(height: 20),
          ProductDetailSpecifications(specifications: product.specifications),
          if (product.specifications.isNotEmpty) const SizedBox(height: 20),
          ProductDetailReviewsSection(
            reviews: detail.reviews,
            averageRating: product.averageRating,
            totalReviews: product.totalReviews,
            ratingBreakdown: detail.ratingBreakdown,
            onViewAll: () => context.push('/product/${product.id}/reviews'),
          ),
          const SizedBox(height: 20),
          _ReplacementLine(available: product.replacementAvailable),
          if (detail.relatedProducts.isNotEmpty) ...[
            const SizedBox(height: 24),
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: AppDimens.screenPadding),
              child: Text(
                'You may also like',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  color: AppColors.textPrimary,
                ),
              ),
            ),
            const SizedBox(height: 12),
            SizedBox(
              height: 256,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: AppDimens.screenPadding),
                itemCount: detail.relatedProducts.length,
                separatorBuilder: (_, __) => const SizedBox(width: 12),
                itemBuilder: (_, index) {
                  final related = detail.relatedProducts[index];
                  return SizedBox(
                    width: 150,
                    child: ProductCard(
                      product: related,
                      variant: detail.relatedVariantOf(related.id),
                      // Replace, not push: stacking detail pages would let the
                      // back button walk a chain the customer never chose.
                      onTap: () => context.pushReplacement('/product/${related.id}'),
                    ),
                  );
                },
              ),
            ),
          ],
          const SizedBox(height: 24),
        ],
      ),
    );
  }

  Widget _buildInfo(ProductDetailProvider detail) {
    final product = detail.product!;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppDimens.screenPadding),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (product.categoryName.isNotEmpty)
            Text(
              product.categoryName.toUpperCase(),
              style: const TextStyle(
                color: AppColors.gold,
                fontSize: 11,
                fontWeight: FontWeight.w800,
                letterSpacing: 0.8,
              ),
            ),
          const SizedBox(height: 6),
          Text(
            product.name,
            maxLines: 3,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: AppColors.textPrimary,
              fontSize: 21,
              fontWeight: FontWeight.w800,
              height: 1.2,
            ),
          ),
          // A product with no reviews shows no rating row at all rather than a
          // misleading "0.0".
          if (product.totalReviews > 0) ...[
            const SizedBox(height: 8),
            Row(
              children: [
                const Icon(Icons.star_rounded, size: 17, color: AppColors.gold),
                const SizedBox(width: 4),
                Text(
                  product.averageRating.toStringAsFixed(1),
                  style: const TextStyle(
                    color: AppColors.textPrimary,
                    fontSize: 13.5,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(width: 6),
                Text(
                  '(${product.totalReviews} reviews)',
                  style: const TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 13,
                  ),
                ),
              ],
            ),
          ],
          const SizedBox(height: 12),
          PriceDisplay(
            price: detail.effectivePrice,
            originalPrice: detail.mrp > detail.effectivePrice ? detail.mrp : null,
            fontSize: 24,
          ),
          const SizedBox(height: 8),
          _StockLine(
            inStock: detail.isInStock,
            isLow: detail.isLowStock,
            stock: detail.selectedVariant?.stock ?? 0,
          ),
          const SizedBox(height: 4),
          const Text(
            'Inclusive of all taxes',
            style: TextStyle(color: AppColors.textFaint, fontSize: 12),
          ),
        ],
      ),
    );
  }
}

class _StockLine extends StatelessWidget {
  const _StockLine({
    required this.inStock,
    required this.isLow,
    required this.stock,
  });

  final bool inStock;
  final bool isLow;
  final int stock;

  @override
  Widget build(BuildContext context) {
    late final Color color;
    late final String label;
    if (!inStock) {
      color = AppColors.danger;
      label = 'Out of Stock';
    } else if (isLow) {
      color = AppColors.cta;
      label = 'Only $stock left!';
    } else {
      color = AppColors.brandGreen;
      label = 'In Stock';
    }

    return Row(
      children: [
        Container(
          height: 8,
          width: 8,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 7),
        Text(
          label,
          style: TextStyle(
            color: color,
            fontSize: 13,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    );
  }
}

/// The affiliate strip: "Referral Price: ₹X · You Earn: ₹X per Sale"
/// (spec §2.10, Figma node 46:6173).
///
/// Both numbers come off the SELECTED VARIANT (`referralPrice`, `commission`) —
/// they are per-variant by schema (spec §1.5: MRP ≥ Offer ≥ Referral ≥
/// Commission), so switching colour/size re-prices the earning too.
///
/// Hidden for everyone except admin-allocated affiliates: commission is not
/// customer-facing, and a normal shopper seeing "you earn ₹40" would read it as
/// a discount they're owed.
class _AffiliateBanner extends StatelessWidget {
  const _AffiliateBanner({required this.variant});

  final Variant? variant;

  @override
  Widget build(BuildContext context) {
    final selected = variant;
    if (selected == null) return const SizedBox.shrink();
    if (context.watch<AuthProvider>().currentUser?.isAffiliate != true) {
      return const SizedBox.shrink();
    }
    // A variant priced at zero commission earns nothing — say nothing.
    if (selected.commission <= 0) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppDimens.screenPadding,
        14,
        AppDimens.screenPadding,
        0,
      ),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
        decoration: BoxDecoration(
          color: AppColors.cta.withValues(alpha: 0.10),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppColors.cta.withValues(alpha: 0.45)),
        ),
        child: Row(
          children: [
            const Icon(Icons.sell_outlined,
                size: 18, color: AppColors.goldStrong),
            const SizedBox(width: 10),
            Expanded(
              child: RichText(
                text: TextSpan(
                  style: const TextStyle(
                    fontSize: 12.5,
                    height: 1.35,
                    color: AppColors.textSecondary,
                  ),
                  children: [
                    const TextSpan(text: 'Referral Price: '),
                    TextSpan(
                      text: '₹${selected.referralPrice.toStringAsFixed(0)}',
                      style: const TextStyle(
                        color: AppColors.goldStrong,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const TextSpan(text: '  ·  You Earn: '),
                    TextSpan(
                      text: '₹${selected.commission.toStringAsFixed(0)}',
                      style: const TextStyle(
                        color: AppColors.goldStrong,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const TextSpan(text: ' per Sale'),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ReplacementLine extends StatelessWidget {
  const _ReplacementLine({required this.available});

  final bool available;

  @override
  Widget build(BuildContext context) {
    final color = available ? AppColors.brandGreen : AppColors.muted;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppDimens.screenPadding),
      child: Row(
        children: [
          Icon(
            available
                ? Icons.check_circle_outline_rounded
                : Icons.do_not_disturb_alt_rounded,
            size: 18,
            color: color,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              available
                  ? 'Returns available on this product'
                  : 'Returns not available on this product',
              style: TextStyle(
                color: color,
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
