import 'package:flutter/material.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimens.dart';
import '../../../../core/constants/domain_enums.dart';
import '../../../../core/widgets/cached_image.dart';
import '../../../../core/widgets/status_badge.dart';
import '../../domain/entities/order.dart';
import 'order_format.dart';

/// One row of My Orders — Figma `My orders` (node 46:7022, card 46:7053).
///
/// Three stacked rows inside a 17px-padded white card, 12px apart:
///   1. the reference, with the status badge hard right;
///   2. a strip of 48px product thumbnails, 8px apart, then a "+N" chip;
///   3. "N items · ₹total", with the one action that status allows hard right.
///
/// The action is a TEXT LINK, not a button — that is what the design draws, and
/// it keeps the whole card one tap target for opening the order while the link
/// stays a distinct second target.
///
/// The payment method is deliberately absent even though the prototype shows a
/// "Cash on Delivery" line — COD is removed from the product (design map §4).
class OrderCard extends StatelessWidget {
  const OrderCard({
    super.key,
    required this.order,
    required this.onTap,
    required this.onTrack,
    required this.onReorder,
    this.isReordering = false,
  });

  final Order order;
  final VoidCallback onTap;
  final VoidCallback onTrack;
  final VoidCallback onReorder;

  /// A reorder is in flight for THIS card — the link shows a spinner.
  final bool isReordering;

  /// How many thumbnails render before the "+N" chip takes over.
  static const int _maxThumbs = 3;
  static const double _thumb = 48;

  @override
  Widget build(BuildContext context) {
    final status = OrderStatusX.from(order.status);

    return Material(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(AppDimens.radiusCard),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppDimens.radiusCard),
        child: Container(
          padding: const EdgeInsets.all(17),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppDimens.radiusCard),
            border: Border.all(color: AppColors.hairline),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      OrderFormat.reference(order),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w800,
                        color: AppColors.textPrimary,
                      ),
                    ),
                  ),
                  const SizedBox(width: AppDimens.space10),
                  StatusBadge.forStatus(status.label, dense: true),
                ],
              ),
              const SizedBox(height: AppDimens.space12),
              _thumbnails(),
              const SizedBox(height: AppDimens.space12),
              Row(
                children: [
                  Expanded(child: _itemsAndTotal()),
                  const SizedBox(width: AppDimens.space10),
                  _action(status),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// "3 items · ₹111.00" — the count in secondary, the money in gold, one line.
  Widget _itemsAndTotal() {
    final count = order.totalItems;
    return Text.rich(
      TextSpan(
        children: [
          TextSpan(text: '$count ${count == 1 ? 'item' : 'items'} · '),
          TextSpan(
            text: OrderFormat.money(order.grandTotal),
            style: const TextStyle(
              fontWeight: FontWeight.w800,
              color: AppColors.goldStrong,
            ),
          ),
        ],
      ),
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
      style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
    );
  }

  /// Up to three 48px thumbnails side by side, then a "+N" chip. The design
  /// spaces them 8px apart rather than overlapping them.
  Widget _thumbnails() {
    final images = order.items.map((i) => i.productImage).toList();
    final shown = images.take(_maxThumbs).toList();
    final extra = images.length - shown.length;

    return SizedBox(
      height: _thumb,
      child: Row(
        children: [
          for (final image in shown) ...[
            Container(
              width: _thumb,
              height: _thumb,
              clipBehavior: Clip.antiAlias,
              decoration: BoxDecoration(
                color: AppColors.surfaceSubtle,
                borderRadius: BorderRadius.circular(AppDimens.radiusMd),
              ),
              child: CachedImage(url: image, fit: BoxFit.cover),
            ),
            const SizedBox(width: AppDimens.space8),
          ],
          if (extra > 0)
            Container(
              width: _thumb,
              height: _thumb,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: AppColors.surfaceSubtle,
                borderRadius: BorderRadius.circular(AppDimens.radiusMd),
              ),
              child: Text(
                '+$extra',
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textSecondary,
                ),
              ),
            ),
        ],
      ),
    );
  }

  /// Active → Track, Delivered → Reorder, Cancelled → a static "Refunded to
  /// wallet" note (spec §2.17). All three are text, per the design.
  Widget _action(OrderStatus status) {
    if (status == OrderStatus.cancelled) {
      return const Text(
        'Refunded to wallet',
        style: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w700,
          color: AppColors.semanticSuccess,
        ),
      );
    }

    if (isReordering) {
      return const SizedBox(
        height: 16,
        width: 16,
        child: CircularProgressIndicator(strokeWidth: 2),
      );
    }

    final isDelivered = status == OrderStatus.delivered;
    return GestureDetector(
      onTap: isDelivered ? onReorder : onTrack,
      behavior: HitTestBehavior.opaque,
      child: Padding(
        // Vertical only — a horizontal inset would pull the label off the
        // card's right margin, which is where the design aligns it.
        padding: const EdgeInsets.symmetric(vertical: AppDimens.space6),
        child: Text(
          isDelivered ? 'Reorder' : 'Track',
          style: const TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w700,
            color: AppColors.brandGreen,
          ),
        ),
      ),
    );
  }
}
