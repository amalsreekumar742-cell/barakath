import 'package:flutter/material.dart';

import '../constants/app_colors.dart';
import '../constants/app_dimens.dart';
import 'empty_state.dart';
import 'error_state.dart';
import 'shimmer_loading.dart';

/// The list every Batch-4 feature uses: cursor pagination that loads the next
/// page on its own as the customer reaches the end, a shimmer skeleton on first
/// load, and a message-only empty state (spec §2.25 — empty states carry no
/// action button).
///
/// The next page is requested when the footer spinner is built — i.e. when the
/// end of the list comes within the viewport's cache extent — so a page is read
/// only once the customer has scrolled to it. A first page too short to fill
/// the screen keeps loading until it does (or the data runs out).
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
    return _AutoLoadFooter(
      // Keyed on the row count, so every page that lands mounts a FRESH footer
      // and the next request fires only if that new footer is on screen. A
      // load that adds nothing (it failed) keeps the same footer, which then
      // offers a retry instead of re-requesting in a loop.
      key: ValueKey<int>(items.length),
      isLoadingMore: isLoadingMore,
      // A pull-to-refresh is rebuilding page one — paging the old cursor
      // meanwhile would append rows the refresh is about to replace.
      canLoad: !isLoading,
      onLoadMore: onLoadMore,
    );
  }
}

/// The list's last slot while more pages exist: requests the next page as soon
/// as it is built, and shows a spinner while that page loads.
class _AutoLoadFooter extends StatefulWidget {
  const _AutoLoadFooter({
    super.key,
    required this.isLoadingMore,
    required this.canLoad,
    required this.onLoadMore,
  });

  final bool isLoadingMore;
  final bool canLoad;
  final VoidCallback onLoadMore;

  @override
  State<_AutoLoadFooter> createState() => _AutoLoadFooterState();
}

class _AutoLoadFooterState extends State<_AutoLoadFooter> {
  /// A load finished without adding rows (otherwise the row-count key would
  /// have replaced this footer) — almost always a failed read.
  bool _stalled = false;

  @override
  void initState() {
    super.initState();
    // After the frame: the load notifies listeners, which must not happen
    // while the list is still building.
    WidgetsBinding.instance.addPostFrameCallback((_) => _request());
  }

  @override
  void didUpdateWidget(_AutoLoadFooter old) {
    super.didUpdateWidget(old);
    if (old.isLoadingMore && !widget.isLoadingMore) {
      setState(() => _stalled = true);
    }
    // A refresh held the request back and has now finished with the same row
    // count (so this footer was kept) — make the request it skipped.
    if (!old.canLoad && widget.canLoad) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _request());
    }
  }

  void _request() {
    if (!mounted || widget.isLoadingMore || !widget.canLoad) return;
    widget.onLoadMore();
  }

  void _retry() {
    setState(() => _stalled = false);
    _request();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppDimens.space16),
      child: Center(
        child: _stalled && !widget.isLoadingMore
            ? TextButton(
                onPressed: _retry,
                child: const Text(
                  "Couldn't load more. Tap to retry",
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: AppColors.brandGreen,
                  ),
                ),
              )
            : const SizedBox(
                width: 22,
                height: 22,
                child: CircularProgressIndicator(
                  strokeWidth: 2.2,
                  color: AppColors.brandGreen,
                ),
              ),
      ),
    );
  }
}
