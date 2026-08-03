import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimens.dart';
import '../../../../core/utils/constants.dart';
import '../../../../core/widgets/circle_back_button.dart';
import '../../../../core/widgets/empty_state.dart';
import '../../../../core/widgets/error_state.dart';
import '../../../../core/widgets/product_card.dart';
import '../../../../core/widgets/shimmer_loading.dart';
import '../../../categories/presentation/providers/categories_provider.dart';
import '../providers/product_listing_provider.dart';
import '../widgets/filter_bottom_sheet.dart';
import '../widgets/sort_bottom_sheet.dart';

/// The product listing grid (spec §2.9), reached from a category, a
/// sub-category, or the "New Arrivals" entry point.
///
/// Every input arrives as a go_router query parameter
/// (`/product-listing?categoryId=&subCategory=&categoryName=&newArrivals=`) so
/// the screen is deep-linkable and needs no `extra` payload.
class ProductListingPage extends StatefulWidget {
  const ProductListingPage({
    super.key,
    this.categoryId,
    this.subCategory,
    this.categoryName,
    this.newArrivals = false,
    this.flashSale = false,
  });

  final String? categoryId;
  final String? subCategory;
  final String? categoryName;
  final bool newArrivals;
  final bool flashSale;

  @override
  State<ProductListingPage> createState() => _ProductListingPageState();
}

class _ProductListingPageState extends State<ProductListingPage> {
  final ScrollController _scrollController = ScrollController();

  /// Sub-category names for the filter sheet — resolved from the category so
  /// the sheet works on a cold deep link too.
  List<String> _subCategories = const [];

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      context.read<ProductListingProvider>().fetchProducts(
            categoryId: widget.categoryId,
            subCategory: widget.subCategory,
            newArrivalsOnly: widget.newArrivals,
            flashSaleOnly: widget.flashSale,
          );
      _loadSubCategories();
    });
  }

  @override
  void dispose() {
    _scrollController.removeListener(_onScroll);
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _loadSubCategories() async {
    final id = widget.categoryId;
    if (id == null || id.isEmpty) return;
    final category = await context.read<CategoriesProvider>().getCategoryById(id);
    if (!mounted || category == null) return;
    setState(() => _subCategories = category.subCategories);
  }

  /// Prefetch one screen ahead so the next page is usually already there by the
  /// time the user reaches the bottom.
  void _onScroll() {
    if (!_scrollController.hasClients) return;
    final position = _scrollController.position;
    if (position.pixels >= position.maxScrollExtent - 400) {
      context.read<ProductListingProvider>().loadMore();
    }
  }

  String get _title {
    if (widget.flashSale) return 'Flash Sale';
    if (widget.newArrivals) return 'New Arrivals';
    final sub = widget.subCategory;
    if (sub != null && sub.isNotEmpty) return sub;
    final name = widget.categoryName;
    if (name != null && name.isNotEmpty) return name;
    return 'All Products';
  }

  Future<void> _openFilters() async {
    final provider = context.read<ProductListingProvider>();
    final result = await FilterBottomSheet.show(
      context,
      subCategories: _subCategories,
      selectedSubCategory: provider.subCategory,
      priceMin: provider.priceMin,
      priceMax: provider.priceMax,
      minRating: provider.minRating,
      priceCeiling: _priceCeiling(provider),
    );
    if (result == null) return;
    await provider.applyFilters(
      subCategory: result.subCategory,
      priceMin: result.priceMin,
      priceMax: result.priceMax,
      minRating: result.minRating,
    );
  }

  /// Slider top stop, rounded up from the dearest product on screen so the
  /// range always covers the catalogue the customer is actually looking at.
  double _priceCeiling(ProductListingProvider provider) {
    var highest = 0.0;
    for (final product in provider.products) {
      final price =
          provider.variantFor(product.id)?.effectivePrice ?? product.maxPrice;
      if (price > highest) highest = price;
    }
    if (highest <= 0) return 5000;
    return (highest / 100).ceil() * 100;
  }

  Future<void> _openSort() async {
    final provider = context.read<ProductListingProvider>();
    final sort = await SortBottomSheet.show(context, provider.sortBy);
    if (sort == null) return;
    await provider.updateSort(sort);
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<ProductListingProvider>();

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Column(
          children: [
            // Figma node 50:8514 — circular back, title, wishlist shortcut.
            Padding(
              padding: const EdgeInsets.fromLTRB(
                AppDimens.screenPadding,
                8,
                AppDimens.screenPadding,
                10,
              ),
              child: Row(
                children: [
                  const CircleBackButton(),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      _title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -0.4,
                        color: AppColors.textPrimary,
                      ),
                    ),
                  ),
                  GestureDetector(
                    onTap: () => context.push('/search'),
                    behavior: HitTestBehavior.opaque,
                    child: const Padding(
                      padding: EdgeInsets.symmetric(horizontal: 4),
                      child: Icon(Icons.search_rounded,
                          size: 22, color: AppColors.textPrimary),
                    ),
                  ),
                ],
              ),
            ),
            _SubCategoryChips(
              categoryId: widget.categoryId,
              selected: provider.subCategory,
              onSelect: (value) => context
                  .read<ProductListingProvider>()
                  .updateSubCategory(value),
            ),
            _FilterSortBar(
              activeFilterCount: provider.activeFilterCount,
              itemCount: provider.products.length,
              hasMore: provider.hasMore,
              onFilters: _openFilters,
              onSort: _openSort,
            ),
            Expanded(child: _buildBody(provider)),
          ],
        ),
      ),
    );
  }

  Widget _buildBody(ProductListingProvider provider) {
    if (provider.isLoading && provider.products.isEmpty) {
      // ShimmerGrid shrink-wraps, so it needs its own scroll parent to clip
      // rather than overflow when a page's worth of skeletons is taller than
      // the viewport.
      return const SingleChildScrollView(
        physics: NeverScrollableScrollPhysics(),
        child: ShimmerGrid(itemCount: PageSizes.heavy, childAspectRatio: 0.62),
      );
    }

    if (provider.error != null && provider.products.isEmpty) {
      return ErrorState(
        message: provider.error!,
        onRetry: () => context.read<ProductListingProvider>().resetAndFetch(),
      );
    }

    if (provider.products.isEmpty) {
      return EmptyState(
        icon: Icons.inventory_2_outlined,
        title: 'No products found',
        subtitle: provider.hasActiveFilters
            ? 'Try adjusting your filters.'
            : 'New products will show up here soon.',
        actionLabel: provider.hasActiveFilters ? 'Clear Filters' : null,
        onAction: provider.hasActiveFilters
            ? () => context.read<ProductListingProvider>().clearFilters()
            : null,
      );
    }

    // The trailing shimmer row is a grid cell pair, so it lines up with the
    // cards instead of jumping the layout while the next page loads.
    final showLoader = provider.isLoadingMore;

    return RefreshIndicator(
      onRefresh: () => context.read<ProductListingProvider>().resetAndFetch(),
      child: GridView.builder(
        controller: _scrollController,
        padding: const EdgeInsets.fromLTRB(
          AppDimens.screenPadding,
          16,
          AppDimens.screenPadding,
          24,
        ),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          crossAxisSpacing: 14,
          mainAxisSpacing: 14,
          mainAxisExtent: 256,
        ),
        itemCount: provider.products.length + (showLoader ? 2 : 0),
        itemBuilder: (context, index) {
          if (index >= provider.products.length) {
            return const ShimmerProductCard();
          }
          final product = provider.products[index];
          return ProductCard(
            product: product,
            variant: provider.variantFor(product.id),
          );
        },
      ),
    );
  }
}

/// The sub-category pill row under the title (Figma node 50:8524). Sourced from
/// the already-loaded categories list, so it costs no extra read; it hides
/// entirely when this listing isn't scoped to a category with sub-categories.
class _SubCategoryChips extends StatelessWidget {
  const _SubCategoryChips({
    required this.categoryId,
    required this.selected,
    required this.onSelect,
  });

  final String? categoryId;
  final String? selected;
  final ValueChanged<String?> onSelect;

  @override
  Widget build(BuildContext context) {
    if (categoryId == null || categoryId!.isEmpty) {
      return const SizedBox.shrink();
    }

    List<String> subs = const [];
    try {
      final categories = context.watch<CategoriesProvider>().categories;
      for (final category in categories) {
        if (category.id == categoryId) {
          subs = category.subCategories;
          break;
        }
      }
    } catch (_) {
      return const SizedBox.shrink();
    }
    if (subs.isEmpty) return const SizedBox.shrink();

    return SizedBox(
      height: 42,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.fromLTRB(
          AppDimens.screenPadding,
          2,
          AppDimens.screenPadding,
          12,
        ),
        itemCount: subs.length + 1,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (_, index) {
          final label = index == 0 ? 'All' : subs[index - 1];
          final value = index == 0 ? null : subs[index - 1];
          final active = selected == value;
          return _Pill(
            label: label,
            active: active,
            onTap: () => onSelect(value),
          );
        },
      ),
    );
  }
}

/// A pill in the sub-category row: filled green when active (Figma 50:8525).
class _Pill extends StatelessWidget {
  const _Pill({required this.label, required this.active, required this.onTap});

  final String label;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        alignment: Alignment.center,
        padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 6),
        decoration: BoxDecoration(
          color: active ? AppColors.brandGreen : AppColors.surface,
          borderRadius: BorderRadius.circular(9999),
          border: Border.all(
            color: active ? AppColors.brandGreen : AppColors.hairline,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 13,
            height: 1.2,
            fontWeight: FontWeight.w700,
            color: active ? Colors.white : AppColors.textPrimary,
          ),
        ),
      ),
    );
  }
}

/// Item count on the left, Sort and Filter pills on the right (Figma 50:8537).
/// Filter turns green-tinted while any filter is on, so the state survives the
/// sheet closing.
class _FilterSortBar extends StatelessWidget {
  const _FilterSortBar({
    required this.activeFilterCount,
    required this.itemCount,
    required this.hasMore,
    required this.onFilters,
    required this.onSort,
  });

  final int activeFilterCount;
  final int itemCount;
  final bool hasMore;
  final VoidCallback onFilters;
  final VoidCallback onSort;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(
        AppDimens.screenPadding,
        0,
        AppDimens.screenPadding,
        13,
      ),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: AppColors.hairline)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text.rich(
              TextSpan(
                children: [
                  TextSpan(
                    // "+" because this is what's loaded so far, not a server
                    // total — claiming an exact count while paging would lie.
                    text: '$itemCount${hasMore ? '+' : ''}',
                    style: const TextStyle(
                      fontWeight: FontWeight.w800,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  // "1 items" reads like a bug to the customer; only a lone,
                  // fully-loaded result is singular ("1+" is still plural).
                  TextSpan(
                    text: itemCount == 1 && !hasMore ? ' item' : ' items',
                  ),
                ],
              ),
              style: const TextStyle(
                  fontSize: 13, color: AppColors.textSecondary),
            ),
          ),
          _BarPill(
            icon: Icons.swap_vert_rounded,
            label: 'Sort',
            active: false,
            onTap: onSort,
          ),
          const SizedBox(width: 8),
          _BarPill(
            icon: Icons.tune_rounded,
            label: activeFilterCount > 0
                ? 'Filter · $activeFilterCount'
                : 'Filter',
            active: activeFilterCount > 0,
            onTap: onFilters,
          ),
        ],
      ),
    );
  }
}

class _BarPill extends StatelessWidget {
  const _BarPill({
    required this.icon,
    required this.label,
    required this.active,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = active ? AppColors.brandGreen : AppColors.textPrimary;
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 9),
        decoration: BoxDecoration(
          color: active ? AppColors.brandGreenSubtle : Colors.transparent,
          borderRadius: BorderRadius.circular(9999),
          border: Border.all(
            color: active ? AppColors.brandGreen : AppColors.hairline,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 15, color: color),
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: color,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
