import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimens.dart';
import '../../../../core/widgets/cached_image.dart';
import '../../domain/entities/reviewable_item.dart';

/// The "what am I rating" card at the top of the Write Review screen: the
/// product image, its name, and the variant + delivery date beneath it.
///
/// Every value comes from the ORDER's line-item snapshot, so it says what was
/// actually bought even if the catalogue has moved on since.
class ReviewProductHeader extends StatelessWidget {
  const ReviewProductHeader({super.key, required this.item});

  final ReviewableItem item;

  @override
  Widget build(BuildContext context) {
    final parts = <String>[
      if (item.variantName.trim().isNotEmpty) item.variantName.trim(),
      if (item.deliveredAt != null)
        'Delivered on ${DateFormat('d MMM').format(item.deliveredAt!)}',
    ];

    return Container(
      padding: const EdgeInsets.all(AppDimens.cardPadding),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppDimens.radiusCard),
        border: Border.all(color: AppColors.hairline),
      ),
      child: Row(
        children: [
          CachedImage(
            url: item.productImage,
            width: 56,
            height: 56,
            borderRadius: AppDimens.radiusMd,
          ),
          const SizedBox(width: AppDimens.space12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
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
                if (parts.isNotEmpty) ...[
                  const SizedBox(height: AppDimens.space4),
                  Text(
                    parts.join(' · '),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 12,
                      color: AppColors.textSecondary,
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
}
