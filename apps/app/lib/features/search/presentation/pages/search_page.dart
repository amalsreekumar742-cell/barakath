import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/utils/debouncer.dart';
import '../../../../core/widgets/empty_state.dart';
import '../../../../core/widgets/error_state.dart';
import '../../../../core/widgets/product_card.dart';
import '../../../../core/widgets/shimmer_loading.dart';
import '../providers/search_provider.dart';
import '../widgets/search_suggestions_view.dart';

/// Product search (spec §2.7). Guests search freely — no auth gate here.
class SearchPage extends StatefulWidget {
  const SearchPage({super.key});

  @override
  State<SearchPage> createState() => _SearchPageState();
}

class _SearchPageState extends State<SearchPage> {
  final _controller = TextEditingController();
  final _focusNode = FocusNode();
  final _scrollController = ScrollController();
  final _debouncer = Debouncer(milliseconds: 300);

  /// Result tiles are tall (square image + name + price + rating), so the grid
  /// cells need to be noticeably taller than wide or the text clips.
  static const double _cardAspectRatio = 0.62;

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
    // The screen opens with the keyboard up, so the first frame must already
    // have the provider's initial content in place.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final provider = context.read<SearchProvider>();
      provider.loadRecentSearches();
      provider.loadTrendingSearches();
    });
  }

  @override
  void dispose() {
    _debouncer.dispose();
    _scrollController.removeListener(_onScroll);
    _scrollController.dispose();
    _controller.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  /// Prefetch the next page before the customer reaches the very bottom, so
  /// paging feels continuous rather than stop-start.
  void _onScroll() {
    if (!_scrollController.hasClients) return;
    final position = _scrollController.position;
    if (position.pixels >= position.maxScrollExtent - 300) {
      context.read<SearchProvider>().loadMore();
    }
  }

  void _onChanged(String value) {
    _debouncer.run(() {
      if (!mounted) return;
      context.read<SearchProvider>().search(value);
    });
  }

  /// Submitting bypasses the debounce — the customer already committed.
  void _onSubmitted(String value) {
    _debouncer.dispose();
    context.read<SearchProvider>().search(value);
  }

  /// Fill the field from a recent/trending term and search it immediately.
  void _searchTerm(String term) {
    _controller.text = term;
    _controller.selection = TextSelection.collapsed(offset: term.length);
    _focusNode.unfocus();
    context.read<SearchProvider>().search(term);
  }

  void _clearField() {
    _debouncer.dispose();
    _controller.clear();
    context.read<SearchProvider>().clearResults();
  }

  Future<void> _confirmClearAll() async {
    final provider = context.read<SearchProvider>();
    // Global rule: confirmation dialog before every destructive action.
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Clear recent searches?'),
        content: const Text('Your search history will be removed from this device.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Clear All', style: TextStyle(color: AppColors.danger)),
          ),
        ],
      ),
    );
    if (confirmed == true) await provider.clearRecentSearches();
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<SearchProvider>();

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Column(
          children: [
            _SearchBarRow(
              controller: _controller,
              focusNode: _focusNode,
              onChanged: _onChanged,
              onSubmitted: _onSubmitted,
              onClear: _clearField,
              onBack: () => context.pop(),
            ),
            Expanded(child: _body(provider)),
          ],
        ),
      ),
    );
  }

  Widget _body(SearchProvider provider) {
    if (provider.error != null && provider.results.isEmpty) {
      return ErrorState(message: provider.error!, onRetry: provider.retry);
    }
    if (provider.isSearching) {
      return const ShimmerGrid(
        itemCount: 6,
        childAspectRatio: _cardAspectRatio,
        padding: EdgeInsets.fromLTRB(20, 12, 20, 20),
      );
    }
    if (provider.isInitial) {
      return SearchSuggestionsView(
        recentSearches: provider.recentSearches,
        trendingSearches: provider.trendingSearches,
        onTermTap: _searchTerm,
        onRemoveRecent: provider.removeRecentSearch,
        onClearAll: _confirmClearAll,
      );
    }
    if (provider.results.isEmpty) {
      return EmptyState(
        icon: Icons.search_off_rounded,
        title: 'No products found for "${provider.query}"',
        subtitle: 'Try a different search term',
      );
    }
    return _ResultsView(
      provider: provider,
      scrollController: _scrollController,
      childAspectRatio: _cardAspectRatio,
    );
  }
}

/// Back button + the pill search field. A custom row rather than an AppBar so
/// the field can own the full width at the design's pill radius.
class _SearchBarRow extends StatelessWidget {
  const _SearchBarRow({
    required this.controller,
    required this.focusNode,
    required this.onChanged,
    required this.onSubmitted,
    required this.onClear,
    required this.onBack,
  });

  final TextEditingController controller;
  final FocusNode focusNode;
  final ValueChanged<String> onChanged;
  final ValueChanged<String> onSubmitted;
  final VoidCallback onClear;
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 10, 20, 12),
      child: Row(
        children: [
          GestureDetector(
            onTap: onBack,
            behavior: HitTestBehavior.opaque,
            child: Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: AppColors.surface,
                border: Border.all(color: AppColors.hairline),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.arrow_back_rounded,
                  size: 20, color: AppColors.textPrimary),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              decoration: BoxDecoration(
                color: AppColors.surface,
                border: Border.all(color: AppColors.brandGreen),
                borderRadius: BorderRadius.circular(9999),
              ),
              child: Row(
                children: [
                  const Icon(Icons.search_rounded,
                      size: 18, color: AppColors.textPrimary),
                  const SizedBox(width: 10),
                  Expanded(
                    child: TextField(
                      controller: controller,
                      focusNode: focusNode,
                      autofocus: true,
                      textInputAction: TextInputAction.search,
                      onChanged: onChanged,
                      onSubmitted: onSubmitted,
                      style: const TextStyle(
                          fontSize: 14, color: AppColors.textPrimary),
                      decoration: const InputDecoration(
                        isDense: true,
                        border: InputBorder.none,
                        enabledBorder: InputBorder.none,
                        focusedBorder: InputBorder.none,
                        contentPadding: EdgeInsets.symmetric(vertical: 12),
                        hintText: 'Search perfumes, books, clothing…',
                        hintStyle:
                            TextStyle(fontSize: 14, color: AppColors.textFaint),
                      ),
                    ),
                  ),
                  // Rebuilds on every keystroke without rebuilding the field.
                  ValueListenableBuilder<TextEditingValue>(
                    valueListenable: controller,
                    builder: (_, value, __) {
                      if (value.text.isEmpty) return const SizedBox.shrink();
                      return GestureDetector(
                        onTap: onClear,
                        behavior: HitTestBehavior.opaque,
                        child: const Padding(
                          padding: EdgeInsets.only(left: 8),
                          child: Icon(Icons.close_rounded,
                              size: 16, color: AppColors.textSecondary),
                        ),
                      );
                    },
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Result count header + the 2-column grid, with a shimmer row appended while
/// the next page loads.
class _ResultsView extends StatelessWidget {
  const _ResultsView({
    required this.provider,
    required this.scrollController,
    required this.childAspectRatio,
  });

  final SearchProvider provider;
  final ScrollController scrollController;
  final double childAspectRatio;

  @override
  Widget build(BuildContext context) {
    final results = provider.results;

    return CustomScrollView(
      controller: scrollController,
      slivers: [
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(20, 6, 20, 12),
          sliver: SliverToBoxAdapter(
            child: Text.rich(
              TextSpan(
                children: [
                  TextSpan(
                    text: '${results.length} result${results.length == 1 ? '' : 's'}',
                    style: const TextStyle(
                      fontWeight: FontWeight.w800,
                      color: AppColors.ink,
                    ),
                  ),
                  TextSpan(text: ' for "${provider.query}"'),
                ],
              ),
              style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
            ),
          ),
        ),
        SliverPadding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          sliver: SliverGrid.builder(
            itemCount: results.length,
            // Fixed extent, not a ratio: the card's height is driven by its
            // 128px image and text rows, so it must not stretch with width.
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              crossAxisSpacing: 14,
              mainAxisSpacing: 14,
              mainAxisExtent: 256,
            ),
            itemBuilder: (_, index) {
              final product = results[index];
              return ProductCard(
                product: product,
                variant: provider.variantFor(product.id),
              );
            },
          ),
        ),
        if (provider.isLoadingMore)
          SliverToBoxAdapter(
            child: ShimmerGrid(
              itemCount: 2,
              childAspectRatio: childAspectRatio,
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
            ),
          ),
        const SliverToBoxAdapter(child: SizedBox(height: 24)),
      ],
    );
  }
}
