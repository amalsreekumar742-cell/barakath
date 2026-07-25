import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimens.dart';
import '../../../../core/constants/domain_enums.dart';
import '../../../../core/widgets/app_toast.dart';
import '../../../../core/widgets/error_state.dart';
import '../../../../core/widgets/section_card.dart';
import '../../../../core/widgets/shimmer_loading.dart';
import '../../../../core/widgets/status_badge.dart';
import '../../domain/entities/order.dart';
import '../providers/order_detail_provider.dart';
import '../widgets/order_format.dart';
import '../widgets/tracking_timeline.dart';

/// Order Tracking (spec §2.17): ETA headline, savings, the six-step timeline
/// and the courier block.
class OrderTrackingPage extends StatefulWidget {
  const OrderTrackingPage({super.key, required this.orderId});

  final String orderId;

  @override
  State<OrderTrackingPage> createState() => _OrderTrackingPageState();
}

class _OrderTrackingPageState extends State<OrderTrackingPage> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      // force: false — arriving from Order Detail, the document is already
      // loaded, so this costs nothing.
      context
          .read<OrderDetailProvider>()
          .load(widget.orderId, force: false);
    });
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
            onTap: () => context.canPop()
                ? context.pop()
                : context.go('/orders/${widget.orderId}'),
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
          'Track order',
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
    if (provider.isLoading ||
        provider.state == OrderDetailState.initial ||
        provider.order?.id != widget.orderId) {
      if (provider.state == OrderDetailState.error) {
        return ErrorState(
          message: provider.error ?? 'Could not load this order.',
          onRetry: () =>
              context.read<OrderDetailProvider>().load(widget.orderId),
        );
      }
      return const _TrackingSkeleton();
    }

    final order = provider.order!;
    final status = OrderStatusX.from(order.status);

    return ListView(
      padding: const EdgeInsets.fromLTRB(
        AppDimens.screenPadding,
        AppDimens.space12,
        AppDimens.screenPadding,
        AppDimens.space24,
      ),
      children: [
        _headline(order, status),
        const SizedBox(height: AppDimens.gapCards),
        if (status == OrderStatus.cancelled)
          _cancelledState(order)
        else
          SectionCard(
            title: 'Status',
            child: TrackingTimeline(order: order),
          ),
        if (order.courierName.isNotEmpty || order.trackingId.isNotEmpty) ...[
          const SizedBox(height: AppDimens.gapCards),
          _courier(order),
        ],
      ],
    );
  }

  Widget _headline(Order order, OrderStatus status) {
    final eta = OrderFormat.estimatedDelivery(order);
    final savings = OrderFormat.savings(order);

    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          StatusBadge.forStatus(status.label),
          const SizedBox(height: AppDimens.space10),
          Text(
            switch (status) {
              OrderStatus.delivered =>
                'Delivered on ${OrderFormat.dateShort(eta)}',
              OrderStatus.cancelled => 'This order was cancelled',
              // "Estimated", not "Arriving by": the order document carries no
              // promised date and no courier API is wired up, so this is derived
              // from the order date — see OrderFormat.estimatedDelivery.
              _ => 'Estimated delivery ${OrderFormat.dateShort(eta)}',
            },
            style: const TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w800,
              letterSpacing: -0.4,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: AppDimens.space4),
          Text(
            OrderFormat.itemsAndTotal(order),
            style: const TextStyle(
              fontSize: 13,
              color: AppColors.textSecondary,
            ),
          ),
          if (savings > 0) ...[
            const SizedBox(height: AppDimens.space8),
            Container(
              padding: const EdgeInsets.symmetric(
                horizontal: AppDimens.space10,
                vertical: AppDimens.space6,
              ),
              decoration: BoxDecoration(
                color: AppColors.semanticSuccessSubtle,
                borderRadius: BorderRadius.circular(AppDimens.radiusPill),
              ),
              child: Text(
                'You saved ${OrderFormat.money(savings)}',
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                  color: AppColors.semanticSuccess,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  /// A cancelled order gets a single terminal state, not a timeline — there is
  /// no progress left to show (spec §2.17).
  Widget _cancelledState(Order order) {
    final at = OrderFormat.timestampFor(order, OrderStatus.cancelled) ??
        order.updatedAt;

    return SectionCard(
      title: 'Status',
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 20,
            height: 20,
            decoration: const BoxDecoration(
              color: AppColors.statusError,
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.close_rounded,
                size: 12, color: Colors.white),
          ),
          const SizedBox(width: AppDimens.space12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Cancelled',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  OrderFormat.dateTime(at),
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.textSecondary,
                  ),
                ),
                if (order.cancelReason.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(
                    order.cancelReason,
                    style: const TextStyle(
                      fontSize: 12,
                      color: AppColors.textFaint,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _courier(Order order) {
    return SectionCard(
      title: 'Courier',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (order.courierName.isNotEmpty)
            Text(
              order.courierName.toUpperCase(),
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w800,
                letterSpacing: 0.4,
                color: AppColors.textPrimary,
              ),
            ),
          if (order.trackingId.isNotEmpty) ...[
            const SizedBox(height: AppDimens.space8),
            Row(
              children: [
                Expanded(
                  child: Text(
                    order.trackingId,
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ),
                GestureDetector(
                  onTap: () async {
                    await Clipboard.setData(
                      ClipboardData(text: order.trackingId),
                    );
                    if (mounted) AppToast.success(context, 'Tracking ID copied');
                  },
                  behavior: HitTestBehavior.opaque,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppDimens.space12,
                      vertical: AppDimens.space6,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      borderRadius:
                          BorderRadius.circular(AppDimens.radiusPill),
                      border: Border.all(color: AppColors.hairline),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.copy_rounded,
                            size: 14, color: AppColors.brandGreen),
                        SizedBox(width: AppDimens.space6),
                        Text(
                          'Copy',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: AppColors.textPrimary,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _TrackingSkeleton extends StatelessWidget {
  const _TrackingSkeleton();

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
        ShimmerCard(height: 56),
        SizedBox(height: AppDimens.gapCards),
        ShimmerCard(height: 220),
        SizedBox(height: AppDimens.gapCards),
        ShimmerCard(height: 60),
      ],
    );
  }
}
