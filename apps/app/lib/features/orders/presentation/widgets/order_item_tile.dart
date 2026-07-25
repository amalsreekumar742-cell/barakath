import 'package:flutter/material.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimens.dart';
import '../../../../core/widgets/cached_image.dart';
import '../../../../core/widgets/status_badge.dart';
import '../../../replacement/domain/entities/replacement.dart';
import '../../domain/entities/order.dart';
import 'order_format.dart';

/// One line of an order on the detail screen: thumbnail, name, variant, qty and
/// line total, plus the post-delivery actions.
///
/// RAISING a replacement is no longer per-line — it is the "Replacement" button
/// in the page footer, beside "Invoice". What stays here is the STATUS of a
/// request already raised against this line, which is genuinely per-line
/// information and has nowhere else to live: it renders the design's "Return
/// status" state inline (design map §2: no Batch-4 route owns that frame).
class OrderItemTile extends StatelessWidget {
  const OrderItemTile({
    super.key,
    required this.item,
    required this.isDelivered,
    required this.replacement,
    required this.onWriteReview,
  });

  final OrderItem item;
  final bool isDelivered;
  final Replacement? replacement;
  final VoidCallback onWriteReview;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: AppDimens.tileThumb,
              height: AppDimens.tileThumb,
              clipBehavior: Clip.antiAlias,
              decoration: BoxDecoration(
                color: AppColors.surfaceSubtle,
                borderRadius: BorderRadius.circular(AppDimens.radiusMd),
                border: Border.all(color: AppColors.hairline),
              ),
              child: CachedImage(url: item.productImage, fit: BoxFit.cover),
            ),
            const SizedBox(width: AppDimens.space12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    item.productName,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    _variantLine(),
                    style: const TextStyle(
                      fontSize: 12,
                      color: AppColors.textSecondary,
                    ),
                  ),
                  const SizedBox(height: AppDimens.space6),
                  Row(
                    children: [
                      Text(
                        OrderFormat.money(item.subtotal),
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w800,
                          color: AppColors.goldStrong,
                        ),
                      ),
                      if (item.mrp > item.offerPrice) ...[
                        const SizedBox(width: AppDimens.space8),
                        Text(
                          OrderFormat.money(item.mrp * item.quantity),
                          style: const TextStyle(
                            fontSize: 12,
                            color: AppColors.textFaint,
                            decoration: TextDecoration.lineThrough,
                          ),
                        ),
                      ],
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
        if (isDelivered) ...[
          const SizedBox(height: AppDimens.space10),
          _actions(),
        ],
      ],
    );
  }

  String _variantLine() {
    final parts = <String>[
      if (item.variantName.isNotEmpty) item.variantName,
      if (item.variantColor.isNotEmpty) item.variantColor,
      'Qty ${item.quantity}',
    ];
    return parts.join(' · ');
  }

  Widget _actions() {
    final existing = replacement;

    return Wrap(
      spacing: AppDimens.space8,
      runSpacing: AppDimens.space8,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        _pillButton(
          label: 'Write review',
          icon: Icons.star_border_rounded,
          onTap: onWriteReview,
        ),
        if (existing != null) _replacementState(existing),
      ],
    );
  }

  /// The inline "Return status": request reference + the admin's verdict.
  Widget _replacementState(Replacement existing) {
    final reference =
        existing.requestId.isEmpty ? 'Return request' : existing.requestId;
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppDimens.space10,
        vertical: AppDimens.space8,
      ),
      decoration: BoxDecoration(
        color: AppColors.surfaceSubtle,
        borderRadius: BorderRadius.circular(AppDimens.radiusMd),
        border: Border.all(color: AppColors.hairline),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            reference,
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: AppColors.textSecondary,
            ),
          ),
          const SizedBox(width: AppDimens.space8),
          StatusBadge.forStatus(existing.status, dense: true),
        ],
      ),
    );
  }

  Widget _pillButton({
    required String label,
    required IconData icon,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        padding: const EdgeInsets.symmetric(
          horizontal: AppDimens.space12,
          vertical: AppDimens.space8,
        ),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(AppDimens.radiusPill),
          border: Border.all(color: AppColors.hairline),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 15, color: AppColors.brandGreen),
            const SizedBox(width: AppDimens.space6),
            Text(
              label,
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: AppColors.textPrimary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
