import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimens.dart';
import '../../../../core/constants/domain_enums.dart';
import '../../../../core/widgets/app_toast.dart';
import '../../../../core/widgets/cached_image.dart';
import '../../../../core/widgets/custom_button.dart';
import '../../../../core/widgets/error_state.dart';
import '../../../../core/widgets/key_value_row.dart';
import '../../../../core/widgets/section_card.dart';
import '../../../../core/widgets/shimmer_loading.dart';
import '../../../../core/widgets/status_badge.dart';
import '../../domain/entities/order.dart';
import '../providers/order_detail_provider.dart';
import '../widgets/order_format.dart';
import '../widgets/order_item_tile.dart';

/// Order Detail (spec §2.17).
///
/// Every figure comes from the STORED order document — nothing is recomputed
/// client-side. `createPaymentOrder` priced this order server-side; recomputing
/// from today's catalogue would show a total the customer never paid.
class OrderDetailPage extends StatefulWidget {
  const OrderDetailPage({super.key, required this.orderId});

  final String orderId;

  @override
  State<OrderDetailPage> createState() => _OrderDetailPageState();
}

class _OrderDetailPageState extends State<OrderDetailPage> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<OrderDetailProvider>().load(widget.orderId);
    });
  }

  Future<void> _cancel() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Cancel this order?'),
        content: const Text(
          'The amount you paid is refunded to its original source. This cannot be undone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Keep order'),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Cancel order'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    final error = await context.read<OrderDetailProvider>().cancelOrder();
    if (!mounted) return;
    AppToast.result(context, error: error, successMessage: 'Your order has been cancelled');
  }

  /// The footer's "Replacement" tap.
  ///
  /// A replacement request is raised against ONE line, but the button is one
  /// control — so with a single eligible line it goes straight there, and only
  /// asks which item when the choice is real.
  Future<void> _startReplacement(List<OrderItem> replaceable) async {
    if (replaceable.length == 1) {
      await _openReplacement(replaceable.first);
      return;
    }

    final chosen = await showModalBottomSheet<OrderItem>(
      context: context,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(
          top: Radius.circular(AppDimens.radiusCard),
        ),
      ),
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Padding(
              padding: EdgeInsets.fromLTRB(
                AppDimens.screenPadding,
                AppDimens.space20,
                AppDimens.screenPadding,
                AppDimens.space12,
              ),
              child: Text(
                'Which item?',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                  color: AppColors.textPrimary,
                ),
              ),
            ),
            for (final item in replaceable)
              ListTile(
                onTap: () => Navigator.of(ctx).pop(item),
                leading: ClipRRect(
                  borderRadius: BorderRadius.circular(AppDimens.radiusMd),
                  child: SizedBox(
                    width: 44,
                    height: 44,
                    child: CachedImage(url: item.productImage, fit: BoxFit.cover),
                  ),
                ),
                title: Text(
                  item.productName,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                ),
                subtitle: Text(
                  item.variantName.isEmpty
                      ? 'Qty ${item.quantity}'
                      : '${item.variantName} · Qty ${item.quantity}',
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.textSecondary,
                  ),
                ),
              ),
            const SizedBox(height: AppDimens.space12),
          ],
        ),
      ),
    );

    if (chosen == null || !mounted) return;
    await _openReplacement(chosen);
  }

  Future<void> _openReplacement(OrderItem item) async {
    await context.push(
      '/orders/${widget.orderId}/replace'
      '?productId=${Uri.encodeComponent(item.productId)}'
      '&variantId=${Uri.encodeComponent(item.variantId)}',
    );
    if (!mounted) return;
    // Coming back, the line may now carry a request — refresh so the button is
    // replaced by its status badge.
    await context.read<OrderDetailProvider>().load(widget.orderId);
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<OrderDetailProvider>();

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        titleSpacing: 12,
        leadingWidth: 74,
        leading: Center(
          child: GestureDetector(
            onTap: () =>
                context.canPop() ? context.pop() : context.go('/orders'),
            behavior: HitTestBehavior.opaque,
            child: Container(
              width: 42,
              height: 42,
              margin: const EdgeInsets.only(left: AppDimens.screenPadding),
              decoration: BoxDecoration(
                color: AppColors.surface,
                shape: BoxShape.circle,
                border: Border.all(color: AppColors.hairline),
              ),
              child: const Icon(Icons.arrow_back_rounded,
                  size: 20, color: AppColors.textPrimary),
            ),
          ),
        ),
        title: const Text(
          'Order details',
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
      body: _body(provider),
    );
  }

  Widget _body(OrderDetailProvider provider) {
    if (provider.isLoading || provider.state == OrderDetailState.initial) {
      return const _OrderDetailSkeleton();
    }
    if (provider.state == OrderDetailState.error || provider.order == null) {
      return ErrorState(
        message: provider.error ?? 'Could not load this order.',
        onRetry: () =>
            context.read<OrderDetailProvider>().load(widget.orderId),
      );
    }

    final order = provider.order!;
    final status = OrderStatusX.from(order.status);
    final isDelivered = status == OrderStatus.delivered;

    return ListView(
      padding: const EdgeInsets.fromLTRB(
        AppDimens.screenPadding,
        AppDimens.space12,
        AppDimens.screenPadding,
        AppDimens.space24,
      ),
      children: [
        _statusBanner(order, status),
        const SizedBox(height: AppDimens.gapCards),
        _items(order, provider, isDelivered),
        const SizedBox(height: AppDimens.gapCards),
        _shippingAddress(order),
        const SizedBox(height: AppDimens.gapCards),
        _paymentInfo(order),
        const SizedBox(height: AppDimens.gapCards),
        _priceSummary(order),
        const SizedBox(height: AppDimens.gapSections),
        ..._footerActions(order, status, provider),
      ],
    );
  }

  Widget _statusBanner(Order order, OrderStatus status) {
    final eta = OrderFormat.estimatedDelivery(order);

    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              StatusBadge.forStatus(status.label),
              const Spacer(),
              if (status != OrderStatus.cancelled)
                GestureDetector(
                  onTap: () => context.push('/orders/${order.id}/track'),
                  behavior: HitTestBehavior.opaque,
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        'Track',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: AppColors.brandGreen,
                        ),
                      ),
                      Icon(Icons.chevron_right_rounded,
                          size: 18, color: AppColors.brandGreen),
                    ],
                  ),
                ),
            ],
          ),
          const SizedBox(height: AppDimens.space10),
          Text(
            switch (status) {
              OrderStatus.delivered =>
                'Delivered on ${OrderFormat.dateShort(eta)}',
              OrderStatus.cancelled => 'This order was cancelled',
              _ => 'Estimated delivery ${OrderFormat.dateShort(eta)}',
            },
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w800,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: AppDimens.space4),
          Text(
            'Order ${OrderFormat.reference(order)} · placed ${OrderFormat.date(order.createdAt)}',
            style: const TextStyle(
              fontSize: 12,
              color: AppColors.textSecondary,
            ),
          ),
          if (status == OrderStatus.cancelled &&
              order.cancelReason.isNotEmpty) ...[
            const SizedBox(height: AppDimens.space6),
            Text(
              order.cancelReason,
              style: const TextStyle(
                fontSize: 12,
                color: AppColors.statusError,
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _items(
    Order order,
    OrderDetailProvider provider,
    bool isDelivered,
  ) {
    return SectionCard(
      title: 'Items',
      child: Column(
        children: [
          for (var i = 0; i < order.items.length; i++) ...[
            if (i > 0) ...[
              const SizedBox(height: AppDimens.space12),
              const Divider(height: 1, color: AppColors.hairline),
              const SizedBox(height: AppDimens.space12),
            ],
            OrderItemTile(
              item: order.items[i],
              isDelivered: isDelivered,
              replacement: provider.replacementFor(
                order.items[i].productId,
                order.items[i].variantId,
              ),
              onWriteReview: () => context.push(
                '/reviews/write/${order.id}/${order.items[i].productId}',
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _shippingAddress(Order order) {
    final address = order.shippingAddress;
    return SectionCard(
      title: 'Delivery address',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            address.fullName,
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: AppDimens.space4),
          Text(
            address.formatted,
            style: const TextStyle(
              fontSize: 13,
              height: 1.45,
              color: AppColors.textSecondary,
            ),
          ),
          if (address.phone.isNotEmpty) ...[
            const SizedBox(height: AppDimens.space4),
            Text(
              address.phone,
              style: const TextStyle(
                fontSize: 13,
                color: AppColors.textSecondary,
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _paymentInfo(Order order) {
    // COD is removed from the product — [OrderFormat.paymentMethod] returns null
    // for a Cash-on-Delivery value and the row is simply not rendered.
    final method = OrderFormat.paymentMethod(order);

    return SectionCard(
      title: 'Payment',
      child: Column(
        children: [
          if (method != null) KeyValueRow(label: 'Method', value: method),
          KeyValueRow(
            label: 'Status',
            value: order.paymentStatus,
            valueColor: order.paymentStatus.toLowerCase() == 'paid'
                ? AppColors.semanticSuccess
                : null,
          ),
          if (order.razorpayPaymentId.isNotEmpty)
            KeyValueRow(
              label: 'Transaction ID',
              value: order.razorpayPaymentId,
            ),
        ],
      ),
    );
  }

  Widget _priceSummary(Order order) {
    final savings = OrderFormat.savings(order);

    return SectionCard(
      title: 'Price summary',
      child: Column(
        children: [
          KeyValueRow(
            label: 'Subtotal',
            value: OrderFormat.money(order.subtotal),
          ),
          if (order.couponDiscount > 0)
            KeyValueRow(
              label: order.couponCode.isEmpty
                  ? 'Coupon discount'
                  : 'Coupon (${order.couponCode})',
              value: '− ${OrderFormat.money(order.couponDiscount)}',
              valueColor: AppColors.semanticSuccess,
            ),
          if (order.walletAmountUsed > 0)
            KeyValueRow(
              label: 'Wallet used',
              value: '− ${OrderFormat.money(order.walletAmountUsed)}',
              valueColor: AppColors.semanticSuccess,
            ),
          KeyValueRow(
            label: 'Delivery',
            value: order.deliveryCharge <= 0
                ? 'Free'
                : OrderFormat.money(order.deliveryCharge),
            valueColor:
                order.deliveryCharge <= 0 ? AppColors.semanticSuccess : null,
          ),
          if (order.gstAmount > 0)
            KeyValueRow(
              label: 'GST',
              value: OrderFormat.money(order.gstAmount),
            ),
          const Divider(height: AppDimens.space20, color: AppColors.hairline),
          KeyValueRow(
            label: 'Total paid',
            value: OrderFormat.money(order.grandTotal),
            emphasis: true,
          ),
          if (savings > 0) ...[
            const SizedBox(height: AppDimens.space6),
            Align(
              alignment: Alignment.centerLeft,
              child: Text(
                'You saved ${OrderFormat.money(savings)} on this order',
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: AppColors.semanticSuccess,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  List<Widget> _footerActions(
    Order order,
    OrderStatus status,
    OrderDetailProvider provider,
  ) {
    final replaceable = provider.replaceableItems;

    return [
      // "Invoice" and "Replacement" only when Delivered (spec §2.17), side by
      // side. Replacement used to live per-line inside each item tile; it is one
      // footer action now, so the two post-delivery things a customer can do
      // sit together at the bottom instead of one being buried in the list.
      if (status == OrderStatus.delivered)
        Row(
          children: [
            Expanded(
              child: CustomButton(
                label: 'Invoice',
                icon: Icons.receipt_long_outlined,
                variant: ButtonVariant.outline,
                onPressed: () => context.push('/orders/${order.id}/invoice'),
              ),
            ),
            const SizedBox(width: AppDimens.space12),
            Expanded(
              child: CustomButton(
                label: 'Replacement',
                icon: Icons.assignment_return_outlined,
                variant: ButtonVariant.outline,
                // Disabled rather than hidden: a customer looking for "where do
                // I return this" should find the control and see it is closed,
                // not fail to find it at all.
                isDisabled: replaceable.isEmpty,
                onPressed: replaceable.isEmpty
                    ? null
                    : () => _startReplacement(replaceable),
              ),
            ),
          ],
        ),
      // "Cancel item" only at Pending (spec §2.17).
      if (status == OrderStatus.pending) ...[
        const SizedBox(height: AppDimens.gapCards),
        CustomButton(
          label: 'Cancel item',
          variant: ButtonVariant.danger,
          isLoading: provider.isCancelling,
          onPressed: _cancel,
        ),
      ],
    ];
  }
}

/// Skeleton shaped like the real screen (spec §2.25: skeletons on every load).
class _OrderDetailSkeleton extends StatelessWidget {
  const _OrderDetailSkeleton();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(
        AppDimens.screenPadding,
        AppDimens.space12,
        AppDimens.screenPadding,
        AppDimens.space24,
      ),
      children: const [
        ShimmerCard(height: 40),
        SizedBox(height: AppDimens.gapCards),
        ShimmerCard(height: 120),
        SizedBox(height: AppDimens.gapCards),
        ShimmerCard(height: 60),
        SizedBox(height: AppDimens.gapCards),
        ShimmerCard(height: 90),
      ],
    );
  }
}
