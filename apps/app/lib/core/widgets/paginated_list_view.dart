import 'package:flutter/material.dart';

import '../constants/app_colors.dart';
import '../constants/app_dimens.dart';
import 'custom_button.dart';
import 'empty_state.dart';
import 'error_state.dart';
import 'shimmer_loading.dart';

/// The list every Batch-4 feature uses: cursor pagination with an explicit
/// "View More" button, a shimmer skeleton on first load, and a message-only
/// empty state (spec §2.25 — empty states carry no action button).
///
/// WHY a button and not infinite scroll: the skill mandates cursor pagination,
/// and an explicit tap makes each extra page a deliberate read rather than one
/// the customer triggers by overscrolling.
class PaginatedListView<T> extends StatelessWidget {
  const PaginatedListView({
    super.key,
    required this.items,
    required this.itemBuilder,
    required this.isLoading,
    required this.hasMore,
    required this.onLoadMore,
    this.isLoadingMore = false,
    this.error,
    this.onRetry,
    this.onRefresh,
    this.emptyTitle = 'Nothing here yet',
    this.emptySubtitle,
    this.emptyIcon = Icons.inbox_outlined,
    this.padding,
    this.separator,
    this.skeleton,
    this.skeletonCount = 5,
    this.header,
  });

  final List<T> items;
  final Widget Function(BuildContext context, T item, int index) itemBuilder;

  /// First-page load — shows the skeleton. Subsequent pages use [isLoadingMore].
  final bool isLoading;
  final bool isLoadingMore;
  final bool hasMore;
  final VoidCallback onLoadMore;

  final String? error;
  final VoidCallback? onRetry;

  /// Enables pull-to-refresh when provided.
  final Future<void> Function()? onRefresh;

  final String emptyTitle;
  final String? emptySubtitle;
  final IconData emptyIcon;

  final EdgeInsetsGeometry? padding;
  final Widget? separator;

  /// One skeleton row, repeated [skeletonCount] times. Defaults to a card
  /// placeholder; pass a shape closer to the real row where it matters.
  final Widget? skeleton;
  final int skeletonCount;

  /// Pinned above the list, inside the scroll view (e.g. a balance card).
  final Widget? header;

  @override
  Widget build(BuildContext context) {
    if (isLoading && items.isEmpty) return _buildSkeleton();

    if (error != null && items.isEmpty) {
      final failed = ErrorState(message: error!, onRetry: onRetry);
      // Keep the header. It is content the caller already holds and that a
      // failed LIST read says nothing about — dropping it made the Wallet lose
      // its balance card because the ledger query was denied, even though the
      // balance itself had loaded fine.
      if (header == null) return failed;
      return _wrapRefresh(
        ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            header!,
            SizedBox(
              height: MediaQuery.sizeOf(context).height * 0.5,
              child: failed,
            ),
          ],
        ),
      );
    }

    if (items.isEmpty) {
      final empty = EmptyState(
        icon: emptyIcon,
        title: emptyTitle,
        subtitle: emptySubtitle,
      );
      // Still scrollable, so pull-to-refresh works on an empty list.
      return _wrapRefresh(
        ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            if (header != null) header!,
            SizedBox(
              height: MediaQuery.sizeOf(context).height * 0.5,
              child: empty,
            ),
          ],
        ),
      );
    }

    // +1 slot for the header when present, +1 for the footer.
    final headerCount = header != null ? 1 : 0;

    return _wrapRefresh(
      ListView.separated(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: padding ??
            const EdgeInsets.fromLTRB(
              AppDimens.screenPadding,
              AppDimens.space12,
              AppDimens.screenPadding,
              AppDimens.space24,
            ),
        itemCount: items.length + headerCount + 1,
        separatorBuilder: (_, index) {
          // No separator directly under the header or above the footer.
          if (header != null && index == 0) return const SizedBox(height: 0);
          if (index >= items.length + headerCount - 1) {
            return const SizedBox(height: 0);
          }
          return separator ?? const SizedBox(height: AppDimens.gapCards);
        },
        itemBuilder: (context, index) {
          if (header != null && index == 0) return header!;
          final i = index - headerCount;
          if (i < items.length) return itemBuilder(context, items[i], i);
          return _buildFooter();
        },
      ),
    );
  }

  Widget _wrapRefresh(Widget child) {
    if (onRefresh == null) return child;
    return RefreshIndicator(
      onRefresh: onRefresh!,
      color: AppColors.brandGreen,
      child: child,
    );
  }

  Widget _buildSkeleton() {
    // The header renders during the skeleton too. It is real content the caller
    // already has (a wallet balance, a filter bar) — hiding it made the screen
    // appear to load in two stages and the balance card visibly pop in.
    final headerCount = header != null ? 1 : 0;

    return ListView.separated(
      padding: padding ??
          const EdgeInsets.symmetric(
            horizontal: AppDimens.screenPadding,
            vertical: AppDimens.space12,
          ),
      itemCount: skeletonCount + headerCount,
      separatorBuilder: (_, __) => const SizedBox(height: AppDimens.gapCards),
      itemBuilder: (_, index) {
        if (header != null && index == 0) return header!;
        return skeleton ?? const ShimmerCard(height: 84);
      },
    );
  }

  Widget _buildFooter() {
    if (!hasMore) return const SizedBox(height: AppDimens.space8);
    return Padding(
      padding: const EdgeInsets.only(top: AppDimens.space16),
      child: CustomButton(
        label: 'View More',
        variant: ButtonVariant.outline,
        isLoading: isLoadingMore,
        onPressed: isLoadingMore ? null : onLoadMore,
      ),
    );
  }
}
