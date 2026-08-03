import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimens.dart';
import '../../../../core/widgets/cached_image.dart';
import '../../../../core/widgets/empty_state.dart';
import '../../../../core/widgets/error_state.dart';
import '../../../../core/widgets/shimmer_loading.dart';
import '../../domain/entities/category.dart';
import '../providers/categories_provider.dart';

/// Categories tab (spec §2.8, Figma node 50:8421) — a 2-up grid of gradient
/// tiles, each opening its sub-category screen.
class CategoriesPage extends StatefulWidget {
  const CategoriesPage({super.key});

  @override
  State<CategoriesPage> createState() => _CategoriesPageState();
}

class _CategoriesPageState extends State<CategoriesPage> {
  @override
  void initState() {
    super.initState();
    // The list is cached on the provider, so only the first visit to the tab
    // pays for a read; returning to the tab reuses it.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final provider = context.read<CategoriesProvider>();
      if (!provider.loadedOnce) provider.fetchCategories();
    });
  }

  static const SliverGridDelegateWithFixedCrossAxisCount _grid =
      SliverGridDelegateWithFixedCrossAxisCount(
    crossAxisCount: 2,
    crossAxisSpacing: 14,
    mainAxisSpacing: 14,
    mainAxisExtent: 182,
  );

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<CategoriesProvider>();

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(
                AppDimens.screenPadding,
                8,
                AppDimens.screenPadding,
                12,
              ),
              child: Row(
                children: [
                  const Expanded(
                    child: Text(
                      'Categories',
                      style: TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -0.48,
                        color: AppColors.textPrimary,
                      ),
                    ),
                  ),
                  GestureDetector(
                    onTap: () => context.push('/search'),
                    behavior: HitTestBehavior.opaque,
                    child: Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        color: AppColors.surface,
                        shape: BoxShape.circle,
                        border: Border.all(color: AppColors.hairline),
                      ),
                      child: const Icon(Icons.search_rounded,
                          size: 20, color: AppColors.textPrimary),
                    ),
                  ),
                ],
              ),
            ),
            Expanded(child: _buildBody(provider)),
          ],
        ),
      ),
    );
  }

  Widget _buildBody(CategoriesProvider provider) {
    if (provider.isLoading && provider.categories.isEmpty) {
      return ShimmerLoading(
        child: GridView.builder(
          padding: const EdgeInsets.fromLTRB(
            AppDimens.screenPadding,
            6,
            AppDimens.screenPadding,
            20,
          ),
          gridDelegate: _grid,
          itemCount: 4,
          // 112, not 182: ShimmerCard's `height` is its image block, and the
          // card adds 70px of chrome around it. The grid slot is 182.
          itemBuilder: (_, __) => const ShimmerCard(height: 112),
        ),
      );
    }

    if (provider.error != null && provider.categories.isEmpty) {
      return ErrorState(
        message: provider.error!,
        onRetry: () => context.read<CategoriesProvider>().fetchCategories(),
      );
    }

    if (provider.categories.isEmpty) {
      return const EmptyState(
        icon: Icons.grid_view_outlined,
        title: 'No categories yet',
        subtitle: 'New categories will appear here as soon as they are added.',
      );
    }

    return RefreshIndicator(
      onRefresh: () => context.read<CategoriesProvider>().fetchCategories(),
      color: AppColors.brandGreen,
      child: GridView.builder(
        padding: const EdgeInsets.fromLTRB(
          AppDimens.screenPadding,
          6,
          AppDimens.screenPadding,
          20,
        ),
        physics: const AlwaysScrollableScrollPhysics(),
        gridDelegate: _grid,
        itemCount: provider.categories.length,
        itemBuilder: (context, index) => _CategoryTile(
          category: provider.categories[index],
          gradient: _CategoryTile.gradientFor(index),
        ),
      ),
    );
  }
}

/// One gradient category tile (Figma node 50:8437).
class _CategoryTile extends StatelessWidget {
  const _CategoryTile({required this.category, required this.gradient});

  final Category category;
  final List<Color> gradient;

  /// The design uses four tinted gradients across the grid; categories are
  /// admin-authored and carry no colour, so they cycle by position.
  static const List<List<Color>> _gradients = [
    [Color(0xFFF3E9DF), Color(0xFFE6CFB4)],
    [Color(0xFFE9EFE9), Color(0xFFCFE0D3)],
    [Color(0xFFEFEAE4), Color(0xFFDDD0BD)],
    [Color(0xFFE9F0F2), Color(0xFFCFDFE4)],
  ];

  static List<Color> gradientFor(int index) =>
      _gradients[index % _gradients.length];

  @override
  Widget build(BuildContext context) {
    final count = category.productCount;

    return GestureDetector(
      // Straight to the products. The sub-category landing screen was dropped
      // (user, 2026-07-23): the listing already carries All/<sub> chips, so the
      // extra hop only delayed the customer from seeing anything to buy.
      onTap: () => context.push(
        '/product-listing?categoryId=${category.id}'
        '&categoryName=${Uri.encodeComponent(category.name)}',
      ),
      behavior: HitTestBehavior.opaque,
      child: Container(
        padding: const EdgeInsets.all(16),
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomRight,
            colors: gradient,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            // The admin uploads a category image, so the design's icon slot
            // shows that rather than a generic glyph.
            Container(
              width: 88,
              height: 88,
              // This padding IS the white frame around the image — 4, so the
              // 80px image fills the 88px slot exactly (88 - 4 - 4).
              padding: const EdgeInsets.all(4),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.7),
                borderRadius: BorderRadius.circular(16),
              ),
              child: category.image.trim().isEmpty
                  ? const Icon(Icons.category_outlined,
                      size: 44, color: AppColors.goldStrong)
                  : CachedImage(
                      url: category.image,
                      width: 80,
                      height: 80,
                      borderRadius: 12,
                    ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  category.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w800,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  count == 1 ? '1 product' : '$count products',
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
