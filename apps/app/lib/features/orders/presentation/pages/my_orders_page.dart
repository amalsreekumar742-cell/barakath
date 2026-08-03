import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimens.dart';
import '../../../../core/constants/domain_enums.dart';
import '../../../../core/widgets/app_toast.dart';
import '../../../../core/widgets/circle_back_button.dart';
import '../../../../core/widgets/paginated_list_view.dart';
import '../../../../core/widgets/shimmer_loading.dart';
import '../../../cart/presentation/providers/cart_provider.dart';
import '../../domain/entities/order.dart';
import '../providers/orders_provider.dart';
import '../widgets/order_card.dart';

/// My Orders (spec §2.17).
///
/// TITLE: "My Orders", not the prototype's "Orders and Returns" — design map §4
/// conflict 7; the spec wins.
class MyOrdersPage extends StatefulWidget {
  const MyOrdersPage({super.key});

  @override
  State<MyOrdersPage> createState() => _MyOrdersPageState();
}

class _MyOrdersPageState extends State<MyOrdersPage> {
  /// The card whose Reorder button is currently working, so only that one spins
  /// rather than every card in the list.
  String? _reorderingId;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<OrdersProvider>().load();
    });
  }

  Future<void> _reorder(Order order) async {
    // Spec §2.25: a confirmation dialog before every action.
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Reorder these items?'),
        content: const Text(
          "We'll add everything still in stock to your bag at today's prices.",
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Add to bag'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    setState(() => _reorderingId = order.id);
    final result = await context.read<OrdersProvider>().buildReorder(order);
    if (!mounted) return;
    setState(() => _reorderingId = null);

    if (result.isEmpty) {
      AppToast.error(context, 'None of these items is available right now');
      return;
    }

    final cart = context.read<CartProvider>();
    for (final line in result.items) {
      cart.addToCart(line);
    }

    AppToast.success(
      context,
      result.skipped == 0
          ? 'Added to your bag'
          : 'Added to your bag · ${result.skipped} '
              '${result.skipped == 1 ? "item" : "items"} out of stock '
              '${result.skipped == 1 ? "was" : "were"} skipped',
    );
    context.go('/bag');
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<OrdersProvider>();

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        titleSpacing: 12,
        leadingWidth: CircleBackButton.leadingWidth,
        leading: CircleBackButton.appBarLeading(fallbackRoute: '/home'),
        title: const Text(
          'My Orders',
          style: TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.w800,
            letterSpacing: -0.4,
            color: AppColors.textPrimary,
          ),
        ),
        backgroundColor: AppColors.background,
        elevation: 0,
      ),
      body: Column(
        children: [
          _filterChips(provider),
          Expanded(
            child: PaginatedListView<Order>(
              items: provider.orders,
              isLoading: provider.isLoading,
              isLoadingMore: provider.isLoadingMore,
              hasMore: provider.hasMore,
              onLoadMore: () => context.read<OrdersProvider>().loadMore(),
              error:
                  provider.state == OrdersState.error ? provider.error : null,
              onRetry: () => context.read<OrdersProvider>().load(),
              onRefresh: () => context.read<OrdersProvider>().load(),
              // Spec §2.25: empty states are message only — no action button.
              emptyIcon: Icons.receipt_long_outlined,
              emptyTitle: _emptyTitle(provider.filter),
              emptySubtitle: _emptySubtitle(provider.filter),
              // Figma node 46:7052 — 20px gutters, 4px above the first card,
              // 20px below the last, 14px between.
              padding: const EdgeInsets.fromLTRB(
                AppDimens.screenPadding,
                AppDimens.space4,
                AppDimens.screenPadding,
                AppDimens.space20,
              ),
              separator: const SizedBox(height: AppDimens.space14),
              skeleton: const ShimmerCard(height: 150),
              itemBuilder: (context, order, _) => OrderCard(
                order: order,
                returnStatus: provider.returnStatusFor(order.id),
                isReordering: _reorderingId == order.id,
                onTap: () => context.push('/orders/${order.id}'),
                onTrack: () => context.push('/orders/${order.id}/track'),
                onReorder: () => _reorder(order),
              ),
            ),
          ),
        ],
      ),
    );
  }

  String _emptyTitle(OrderFilter filter) => switch (filter) {
        OrderFilter.all => 'No orders yet',
        OrderFilter.active => 'No orders on the way',
        OrderFilter.delivered => 'Nothing delivered yet',
        OrderFilter.cancelled => 'No cancelled orders',
      };

  String _emptySubtitle(OrderFilter filter) => switch (filter) {
        OrderFilter.all => 'Your orders will appear here once you place one.',
        OrderFilter.active =>
          'Orders still being prepared or shipped show here.',
        OrderFilter.delivered => 'Orders you have received show here.',
        OrderFilter.cancelled => 'Orders you cancelled show here.',
      };

  Widget _filterChips(OrdersProvider provider) {
    return SizedBox(
      height: 46,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(
          horizontal: AppDimens.screenPadding,
          vertical: AppDimens.space4,
        ),
        itemCount: OrderFilter.values.length,
        separatorBuilder: (_, __) => const SizedBox(width: AppDimens.space8),
        itemBuilder: (context, index) {
          final filter = OrderFilter.values[index];
          final selected = provider.filter == filter;
          return GestureDetector(
            onTap: () => context.read<OrdersProvider>().setFilter(filter),
            behavior: HitTestBehavior.opaque,
            child: Container(
              alignment: Alignment.center,
              padding: const EdgeInsets.symmetric(
                horizontal: AppDimens.space12,
                vertical: AppDimens.space6,
              ),
              decoration: BoxDecoration(
                color: selected ? AppColors.brandGreen : AppColors.surface,
                borderRadius: BorderRadius.circular(AppDimens.radiusPill),
                border: Border.all(
                  color: selected ? AppColors.brandGreen : AppColors.hairline,
                ),
              ),
              child: Text(
                filter.label,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: selected ? Colors.white : AppColors.textPrimary,
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}
