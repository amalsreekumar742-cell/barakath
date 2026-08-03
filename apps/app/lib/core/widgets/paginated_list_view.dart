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

  /// The screen gutter, resolved once so EVERY state uses it.
  ///
  /// WHY this is not left to `ListView`'s default: a null `padding` on a
  /// BoxScrollView is not "no padding", it is "the device's safe-area insets" —
  /// so an unpadded list runs edge to edge horizontally AND picks up a
  /// different vertical inset per device. The empty and error branches used to
  /// do exactly that, which is how the Wallet's balance card ended up flush
  /// against the screen edges on an account with no transactions.
  EdgeInsets _padding(BuildContext context) =>
      (padding ??
              const EdgeInsets.fromLTRB(
                AppDimens.screenPadding,
                AppDimens.space12,
                AppDimens.screenPadding,
                AppDimens.space24,
              ))
          .resolve(Directionality.of(context));

  @override
  Widget build(BuildContext context) {
    if (isLoading && items.isEmpty) return _buildSkeleton(context);

    if (error != null && items.isEmpty) {
      // Keep the header. It is content the caller already holds and that a
      // failed LIST read says nothing about — dropping it made the Wallet lose
      // its balance card because the ledger query was denied, even though the
      // balance itself had loaded fine.
      return _buildPlaceholder(
        context,
        ErrorState(message: error!, onRetry: onRetry),
      );
    }

    if (items.isEmpty) {
      return _buildPlaceholder(
        context,
        EmptyState(
          icon: emptyIcon,
          title: emptyTitle,
          subtitle: emptySubtitle,
        ),
      );
    }

    // +1 slot for the header when present, +1 for the footer.
    final headerCount = header != null ? 1 : 0;

    return _wrapRefresh(
      ListView.separated(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: _padding(context),
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

  /// Header (if any) above a centred empty/error block that fills whatever
  /// viewport is left.
  ///
  /// WHY a sliver and not `SizedBox(height: screenHeight * 0.5)`: half the
  /// DEVICE height is unrelated to how much room the header actually left
  /// behind. On a short phone the header plus that box overflowed and pushed
  /// the message under the fold; on a tall one it left a band of dead space and
  /// the message sat far above centre. `SliverFillRemaining` measures the real
  /// leftover extent, so the block is centred identically on every screen.
  Widget _buildPlaceholder(BuildContext context, Widget child) {
    final pad = _padding(context);

    return _wrapRefresh(
      CustomScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        slivers: [
          if (header != null)
            SliverPadding(
              padding: EdgeInsets.only(
                left: pad.left,
                right: pad.right,
                top: pad.top,
              ),
              sliver: SliverToBoxAdapter(child: header!),
            ),
          SliverPadding(
            padding: EdgeInsets.only(
              left: pad.left,
              right: pad.right,
              bottom: pad.bottom,
            ),
            // hasScrollBody: false — the block is a fixed-size box that should
            // stretch to the remaining space, not scroll inside it.
            sliver: SliverFillRemaining(hasScrollBody: false, child: child),
          ),
        ],
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

  Widget _buildSkeleton(BuildContext context) {
    // The header renders during the skeleton too. It is real content the caller
    // already has (a wallet balance, a filter bar) — hiding it made the screen
    // appear to load in two stages and the balance card visibly pop in.
    final headerCount = header != null ? 1 : 0;

    return ListView.separated(
      padding: _padding(context),
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
