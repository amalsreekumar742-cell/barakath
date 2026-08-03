import 'package:flutter/foundation.dart' show listEquals;
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimens.dart';
import '../../../../core/di/injection_container.dart';
import '../../../../core/widgets/app_toast.dart';
import '../../../../core/widgets/cached_image.dart';
import '../../../../core/widgets/circle_back_button.dart';
import '../../../../core/widgets/paginated_list_view.dart';
import '../../../../core/widgets/shimmer_loading.dart';
import '../../../cart/domain/entities/cart_item.dart';
import '../../../cart/presentation/providers/cart_provider.dart';
import '../../../products/domain/entities/product.dart';
import '../../../products/domain/entities/variant.dart';
import '../../../products/domain/usecases/get_first_variants.dart';
import '../../../products/domain/usecases/get_product_detail.dart';
import '../providers/wishlist_provider.dart';

/// One hearted product with the variant that prices it. The variant is nullable
/// because a product with no variants must still render (without a price)
/// rather than disappear from the customer's own list.
class _WishlistEntry {
  const _WishlistEntry({required this.product, this.variant});

  final Product product;
  final Variant? variant;
}

/// Wishlist (spec §2.21, design panel `Browse · Wishlist`): item count, then one
/// row per product with its category, name, variant, price, MRP, a filled heart
/// that removes it and an add-to-bag button.
///
/// WHY the catalogue lookup lives in this State rather than a provider: the
/// wishlist ids are owned by [WishlistProvider] (one listener, app-wide) and
/// this session's scope covers only `presentation/pages/`. The lookup is a
/// screen-local read of two existing product use cases — no Firebase here.
/// Reported for a follow-up: it belongs in a `WishlistCatalogueProvider`.
class WishlistPage extends StatefulWidget {
  const WishlistPage({super.key});

  @override
  State<WishlistPage> createState() => _WishlistPageState();
}

class _WishlistPageState extends State<WishlistPage> {
  final GetProductDetail _getProductDetail = sl<GetProductDetail>();
  final GetFirstVariants _getFirstVariants = sl<GetFirstVariants>();

  /// The wishlist ids this screen has reconciled against, newest write last.
  List<String> _sourceIds = const [];

  final List<_WishlistEntry> _items = [];

  /// Ids we have already resolved — including ones whose product document has
  /// since been deleted, so a missing product is never re-fetched forever.
  final Set<String> _resolvedIds = {};

  bool _isLoading = true;
  bool _isLoadingMore = false;
  String? _error;

  List<String> get _pendingIds =>
      _sourceIds.where((id) => !_resolvedIds.contains(id)).toList();

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // The id list is a live stream; reconcile whenever it changes (another
    // screen's heart, a removal here, a sign-out emptying it).
    final ids = context.watch<WishlistProvider>().productIds.toList();
    if (listEquals(ids, _sourceIds)) return;
    WidgetsBinding.instance.addPostFrameCallback((_) => _sync(ids));
  }

  Future<void> _sync(List<String> ids) async {
    if (!mounted) return;
    setState(() {
      _sourceIds = ids;
      final live = ids.toSet();
      _items.removeWhere((entry) => !live.contains(entry.product.id));
      _resolvedIds.removeWhere((id) => !live.contains(id));
      _error = null;
      _isLoading = _items.isEmpty && ids.isNotEmpty;
    });
    if (_items.isEmpty && ids.isNotEmpty) await _loadMore();
    if (mounted && _isLoading) setState(() => _isLoading = false);
  }

  /// Resolve the next page of ids into products + first variants.
  Future<void> _loadMore() async {
    final next = _pendingIds.take(AppDimens.pageSize).toList();
    if (next.isEmpty) {
      if (mounted) setState(() => _isLoading = false);
      return;
    }

    if (mounted && !_isLoading) setState(() => _isLoadingMore = true);

    // One batched variant read for the page, plus one document read per
    // product — the wishlist has no shared parent to query by.
    final variantsResult = await _getFirstVariants(next);
    final variants = variantsResult.getOrElse(() => const {});
    final products = await Future.wait(next.map(_getProductDetail.call));

    if (!mounted) return;
    setState(() {
      String? firstError;
      for (var i = 0; i < next.length; i++) {
        final id = next[i];
        products[i].fold(
          (failure) {
            // A deleted/archived product is not an error worth showing: mark it
            // resolved so the list moves on. A read failure is.
            firstError ??= failure.message;
            _resolvedIds.add(id);
          },
          (product) {
            _resolvedIds.add(id);
            if (product.status == 'Archived') return;
            _items.add(_WishlistEntry(product: product, variant: variants[id]));
          },
        );
      }
      // Only surface an error when nothing at all could be shown.
      _error = _items.isEmpty ? firstError : null;
      _isLoading = false;
      _isLoadingMore = false;
    });
  }

  // --- Actions --------------------------------------------------------------

  Future<void> _confirmRemove(_WishlistEntry entry) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppDimens.radiusCard),
        ),
        title: const Text(
          'Remove from wishlist?',
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
        ),
        content: Text(
          '${entry.product.name} will be removed from your wishlist.',
          style: const TextStyle(
            fontSize: 14,
            height: 1.45,
            color: AppColors.textSecondary,
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text(
              'Remove',
              style: TextStyle(
                fontWeight: FontWeight.w800,
                color: AppColors.statusError,
              ),
            ),
          ),
        ],
      ),
    );
    if (ok != true || !mounted) return;

    // The provider's stream drives the removal back into this list.
    final error = await context.read<WishlistProvider>().toggle(entry.product.id);
    if (!mounted) return;
    AppToast.result(context, error: error, successMessage: 'Removed from wishlist');
  }

  void _addToBag(_WishlistEntry entry) {
    final variant = entry.variant;
    if (variant == null) {
      AppToast.error(context, 'This item is not available right now');
      return;
    }
    if (!variant.inStock) {
      AppToast.error(context, '${entry.product.name} is out of stock');
      return;
    }

    context.read<CartProvider>().addToCart(
          CartItem(
            productId: entry.product.id,
            variantId: variant.id,
            productName: entry.product.name,
            variantName: variant.name,
            variantColor: variant.color,
            productImage: entry.product.thumbnail.isNotEmpty
                ? entry.product.thumbnail
                : (entry.product.images.isNotEmpty
                    ? entry.product.images.first
                    : ''),
            quantity: 1,
          ),
        );
    AppToast.success(context, '${entry.product.name} added to bag');
  }

  @override
  Widget build(BuildContext context) {
    final count = context.watch<WishlistProvider>().count;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        titleSpacing: AppDimens.space12,
        leadingWidth: CircleBackButton.leadingWidth,
        backgroundColor: AppColors.background,
        elevation: 0,
        leading: CircleBackButton.appBarLeading(fallbackRoute: '/home'),
        title: const Text(
          'Wishlist',
          style: TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.w800,
            letterSpacing: -0.4,
            color: AppColors.textPrimary,
          ),
        ),
        actions: [
          if (count > 0)
            Padding(
              padding: const EdgeInsets.only(right: AppDimens.screenPadding),
              child: Center(
                child: Text(
                  count == 1 ? '1 item' : '$count items',
                  style: const TextStyle(
                    fontSize: 13,
                    color: AppColors.textSecondary,
                  ),
                ),
              ),
            ),
        ],
      ),
      body: PaginatedListView<_WishlistEntry>(
        items: _items,
        isLoading: _isLoading,
        isLoadingMore: _isLoadingMore,
        hasMore: _pendingIds.isNotEmpty,
        onLoadMore: _loadMore,
        error: _error,
        onRetry: _loadMore,
        emptyIcon: Icons.favorite_border_rounded,
        emptyTitle: 'Your wishlist is empty',
        emptySubtitle: 'Tap the heart on any product to save it here.',
        skeleton: const ShimmerListTile(),
        skeletonCount: 6,
        padding: const EdgeInsets.fromLTRB(
          AppDimens.screenPadding,
          AppDimens.space4,
          AppDimens.screenPadding,
          AppDimens.space20,
        ),
        itemBuilder: (context, entry, _) => _WishlistRow(
          entry: entry,
          onRemove: () => _confirmRemove(entry),
          onAddToBag: () => _addToBag(entry),
        ),
      ),
    );
  }
}

/// One wishlist row: 76px thumbnail, category / name / variant / price stack,
/// and the heart + bag actions on the right.
class _WishlistRow extends StatelessWidget {
  const _WishlistRow({
    required this.entry,
    required this.onRemove,
    required this.onAddToBag,
  });

  final _WishlistEntry entry;
  final VoidCallback onRemove;
  final VoidCallback onAddToBag;

  Product get _product => entry.product;

  double get _price => entry.variant?.effectivePrice ?? _product.minPrice;

  /// The struck-through comparison price, or null when nothing is off.
  double? get _mrp {
    final v = entry.variant;
    if (v == null) return null;
    final original = v.flashSalePrice != null ? v.offerPrice : v.mrp;
    return original > v.effectivePrice ? original : null;
  }

  String get _thumbnail {
    final v = entry.variant;
    if (v != null && v.images.isNotEmpty) return v.images.first;
    if (_product.thumbnail.isNotEmpty) return _product.thumbnail;
    return _product.images.isNotEmpty ? _product.images.first : '';
  }

  String get _variantLine {
    final parts = <String>[
      if ((entry.variant?.name ?? '').trim().isNotEmpty) entry.variant!.name.trim(),
      if ((entry.variant?.color ?? '').trim().isNotEmpty) entry.variant!.color.trim(),
    ];
    if (parts.isEmpty && _product.subCategoryName.trim().isNotEmpty) {
      parts.add(_product.subCategoryName.trim());
    }
    return parts.join(' · ');
  }

  @override
  Widget build(BuildContext context) {
    final outOfStock = entry.variant != null
        ? !entry.variant!.inStock
        : _product.isOutOfStock;

    return GestureDetector(
      onTap: () => context.push('/product/${_product.id}'),
      behavior: HitTestBehavior.opaque,
      child: Container(
        padding: const EdgeInsets.all(AppDimens.space12),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(AppDimens.radiusCard),
          border: Border.all(color: AppColors.hairline),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Opacity(
              opacity: outOfStock ? 0.45 : 1,
              child: CachedImage(
                url: _thumbnail,
                width: 76,
                height: 76,
                borderRadius: AppDimens.radiusMd,
              ),
            ),
            const SizedBox(width: AppDimens.space12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (_product.categoryName.trim().isNotEmpty)
                    Text(
                      _product.categoryName.toUpperCase(),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.3,
                        color: AppColors.brandGreen,
                      ),
                    ),
                  const SizedBox(height: 3),
                  Text(
                    _product.name,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  if (_variantLine.isNotEmpty) ...[
                    const SizedBox(height: 3),
                    Text(
                      _variantLine,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 12,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                  const SizedBox(height: AppDimens.space6),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Flexible(
                        child: Text(
                          '₹${_price.toStringAsFixed(2)}',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w800,
                            color: AppColors.goldStrong,
                          ),
                        ),
                      ),
                      if (_mrp != null) ...[
                        const SizedBox(width: AppDimens.space6),
                        Flexible(
                          child: Text(
                            '₹${_mrp!.toStringAsFixed(2)}',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 11,
                              color: AppColors.textFaint,
                              decoration: TextDecoration.lineThrough,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                  if (outOfStock) ...[
                    const SizedBox(height: AppDimens.space4),
                    const Text(
                      'Out of stock',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: AppColors.statusError,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(width: AppDimens.space8),
            SizedBox(
              height: 76,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  // Filled: everything on this screen is, by definition, hearted.
                  GestureDetector(
                    onTap: onRemove,
                    behavior: HitTestBehavior.opaque,
                    child: const Padding(
                      padding: EdgeInsets.only(bottom: AppDimens.space4),
                      child: Icon(
                        Icons.favorite,
                        size: 20,
                        color: AppColors.statusError,
                      ),
                    ),
                  ),
                  GestureDetector(
                    onTap: outOfStock ? null : onAddToBag,
                    behavior: HitTestBehavior.opaque,
                    child: Container(
                      width: 34,
                      height: 34,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: outOfStock
                            ? AppColors.borderStrong
                            : AppColors.brandGreen,
                        borderRadius: BorderRadius.circular(AppDimens.radiusMd),
                      ),
                      child: Icon(
                        Icons.shopping_bag_outlined,
                        size: 16,
                        color: outOfStock ? AppColors.muted : Colors.white,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
