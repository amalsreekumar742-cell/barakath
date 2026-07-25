import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/widgets/empty_state.dart';
import '../../../../core/widgets/error_state.dart';
import '../../../../core/widgets/flash_sale_countdown.dart';
import '../../../../core/widgets/product_card.dart';
import '../providers/home_provider.dart';
import '../widgets/banner_carousel.dart';
import '../widgets/home_app_bar.dart';
import '../widgets/home_skeleton.dart';
import '../widgets/product_row.dart';
import '../widgets/section_header.dart';
import '../widgets/spin_banner.dart';

/// Home tab (spec §2.6): banners, shop-by-category, flash sale with a countdown,
/// new arrivals and a featured grid — each section hidden entirely when empty,
/// so a store that runs no flash sale simply doesn't show one.
class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  static const EdgeInsets _hPadding = EdgeInsets.symmetric(horizontal: 20);

  @override
  void initState() {
    super.initState();
    // Deferred to after the first frame: fetching during initState would call
    // notifyListeners() while this widget is still building.
    WidgetsBinding.instance.addPostFrameCallback(
      (_) => context.read<HomeProvider>().fetchHomeData(),
    );
  }

  @override
  Widget build(BuildContext context) {
    final home = context.watch<HomeProvider>();

    return Scaffold(
      backgroundColor: AppColors.background,
      body: RefreshIndicator(
        onRefresh: () => context.read<HomeProvider>().refreshHome(),
        color: AppColors.brandGreen,
        child: CustomScrollView(
          // Always scrollable so pull-to-refresh works even on the error and
          // empty states, which are shorter than the viewport.
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            const HomeAppBar(),
            ..._body(context, home),
            const SliverToBoxAdapter(child: SizedBox(height: 24)),
          ],
        ),
      ),
    );
  }

  List<Widget> _body(BuildContext context, HomeProvider home) {
    if (home.error != null) {
      return [
        SliverFillRemaining(
          hasScrollBody: false,
          child: ErrorState(
            message: home.error!,
            onRetry: () => context.read<HomeProvider>().refreshHome(),
          ),
        ),
      ];
    }

    // Only the very first load shows the skeleton — a refresh keeps the current
    // content on screen behind the RefreshIndicator.
    if (home.isLoading && home.isEmpty) {
      return const [SliverToBoxAdapter(child: HomeSkeleton())];
    }

    if (home.isEmpty) {
      return const [
        SliverFillRemaining(
          hasScrollBody: false,
          child: EmptyState(
            icon: Icons.storefront_outlined,
            title: 'Nothing here yet',
            subtitle: 'New products and offers will appear here soon.',
          ),
        ),
      ];
    }

    return [
      // Search sits at the top of the scroll area, not in the header, so the
      // greeting stays pinned while search scrolls away (Figma node 46:5343).
      SliverToBoxAdapter(
        child: Padding(
          padding: _hPadding.copyWith(top: 4, bottom: 16),
          child: const HomeSearchBar(),
        ),
      ),
      if (home.banners.isNotEmpty) ...[
        SliverToBoxAdapter(
          child: Padding(
            padding: _hPadding,
            child: BannerCarousel(banners: home.banners),
          ),
        ),
      ],
      // Fixed promo, not admin content — always shown, unlike the banners above.
      _sectionGap,
      const SliverToBoxAdapter(
        child: Padding(padding: _hPadding, child: SpinBanner()),
      ),
      if (home.flashSaleProducts.isNotEmpty) ...[
        _sectionGap,
        SliverToBoxAdapter(
          child: Padding(
            padding: _hPadding,
            child: SectionHeader(
              title: 'Flash sale',
              trailing: home.flashSaleEndDate == null
                  ? null
                  : FlashSaleCountdown(endDate: home.flashSaleEndDate!),
              onViewAll: () => context.push('/product-listing?flashSale=true'),
            ),
          ),
        ),
        const SliverToBoxAdapter(child: SizedBox(height: 14)),
        SliverToBoxAdapter(
          child: ProductRow(
            products: home.flashSaleProducts,
            variants: home.variants,
            padding: _hPadding,
          ),
        ),
      ],
      // New arrivals is a 2-up grid in the design, not a rail like flash sale.
      if (home.newArrivals.isNotEmpty) ...[
        _sectionGap,
        SliverToBoxAdapter(
          child: Padding(
            padding: _hPadding,
            child: SectionHeader(
              title: 'New arrivals',
              onViewAll: () => context.push('/product-listing?newArrivals=true'),
            ),
          ),
        ),
        const SliverToBoxAdapter(child: SizedBox(height: 12)),
        SliverPadding(
          padding: _hPadding,
          sliver: SliverGrid(
            gridDelegate: _grid,
            delegate: SliverChildBuilderDelegate(
              (_, index) {
                final product = home.newArrivals[index];
                return ProductCard(
                  product: product,
                  variant: home.variantOf(product.id),
                );
              },
              childCount: home.newArrivals.length,
            ),
          ),
        ),
      ],
      // One section per category: its name, then that category's products as a
      // horizontal rail. Categories with no products are skipped by the provider,
      // so an empty catalogue never renders a bare heading.
      for (final category in home.categoriesWithProducts) ...[
        _sectionGap,
        SliverToBoxAdapter(
          child: Padding(
            padding: _hPadding,
            child: SectionHeader(
              title: category.name,
              onViewAll: () => context.push(
                '/product-listing?categoryId=${category.id}'
                '&categoryName=${Uri.encodeComponent(category.name)}',
              ),
            ),
          ),
        ),
        const SliverToBoxAdapter(child: SizedBox(height: 14)),
        SliverToBoxAdapter(
          child: ProductRow(
            products: home.productsOf(category.id),
            variants: home.variants,
            padding: _hPadding,
          ),
        ),
      ],
    ];
  }

  Widget get _sectionGap => const SliverToBoxAdapter(child: SizedBox(height: 24));

  /// The design's 2-up product grid: 14px gutter, and a height that matches
  /// [ProductRow]'s rail so the same card looks identical on both surfaces.
  static const SliverGridDelegateWithFixedCrossAxisCount _grid =
      SliverGridDelegateWithFixedCrossAxisCount(
    crossAxisCount: 2,
    crossAxisSpacing: 14,
    mainAxisSpacing: 14,
    mainAxisExtent: 256,
  );
}
