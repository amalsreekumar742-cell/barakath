import 'package:flutter/material.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimens.dart';
import '../../../../core/widgets/custom_button.dart';
import '../../../../core/widgets/shimmer_loading.dart';

/// A cursor-paginated section inside a page that already scrolls.
///
/// WHY not `core/widgets/paginated_list_view.dart`: that widget IS the scroll
/// view, and the affiliate wallet stacks TWO paginated lists (commissions and
/// withdrawals) under one balance card. Two scroll views on one screen fight
/// each other, so this renders a plain [Column] with the same contract —
/// shimmer on first load, a "View More" button for the next page (spec §2.25),
/// and a MESSAGE-ONLY empty state with no action button.
class AffiliateSection extends StatelessWidget {
  const AffiliateSection({
    super.key,
    required this.title,
    required this.itemCount,
    required this.itemBuilder,
    required this.isLoading,
    required this.hasMore,
    required this.onLoadMore,
    required this.emptyMessage,
    this.caption,
    this.isLoadingMore = false,
    this.error,
    this.onRetry,
    this.skeletonCount = 3,
  });

  final String title;
  final String? caption;
  final int itemCount;
  final Widget Function(BuildContext context, int index) itemBuilder;
  final bool isLoading;
  final bool isLoadingMore;
  final bool hasMore;
  final VoidCallback onLoadMore;
  final String emptyMessage;
  final String? error;
  final VoidCallback? onRetry;
  final int skeletonCount;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: const TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w800,
            color: AppColors.textPrimary,
          ),
        ),
        if (caption != null) ...[
          const SizedBox(height: AppDimens.space6),
          Text(
            caption!,
            style: const TextStyle(
              fontSize: 12,
              height: 1.45,
              color: AppColors.textSecondary,
            ),
          ),
        ],
        const SizedBox(height: AppDimens.space12),
        ..._buildBody(context),
      ],
    );
  }

  List<Widget> _buildBody(BuildContext context) {
    if (isLoading && itemCount == 0) {
      return [
        ShimmerLoading(
          child: Column(
            children: List.generate(
              skeletonCount,
              (i) => const Padding(
                padding: EdgeInsets.only(bottom: AppDimens.gapCards),
                child: ShimmerBox(
                  width: double.infinity,
                  height: 84,
                  borderRadius: AppDimens.radiusCard,
                ),
              ),
            ),
          ),
        ),
      ];
    }

    if (error != null && itemCount == 0) {
      return [
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(AppDimens.cardPadding),
          decoration: BoxDecoration(
            color: AppColors.statusErrorSubtle,
            borderRadius: BorderRadius.circular(AppDimens.radiusCard),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                error!,
                style: const TextStyle(
                  fontSize: 13,
                  height: 1.45,
                  color: AppColors.statusError,
                ),
              ),
              if (onRetry != null) ...[
                const SizedBox(height: AppDimens.space10),
                CustomButton(
                  label: 'Retry',
                  variant: ButtonVariant.outline,
                  fullWidth: false,
                  onPressed: onRetry,
                ),
              ],
            ],
          ),
        ),
      ];
    }

    if (itemCount == 0) {
      // Spec §2.25 — empty states are message only, no action button.
      return [
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(
            horizontal: AppDimens.cardPadding,
            vertical: AppDimens.space24,
          ),
          decoration: BoxDecoration(
            color: AppColors.surfaceSubtle,
            borderRadius: BorderRadius.circular(AppDimens.radiusCard),
          ),
          child: Text(
            emptyMessage,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 13,
              height: 1.5,
              color: AppColors.textSecondary,
            ),
          ),
        ),
      ];
    }

    return [
      for (var i = 0; i < itemCount; i++) ...[
        itemBuilder(context, i),
        if (i != itemCount - 1) const SizedBox(height: AppDimens.gapCards),
      ],
      if (hasMore) ...[
        const SizedBox(height: AppDimens.space16),
        CustomButton(
          label: 'View More',
          variant: ButtonVariant.outline,
          isLoading: isLoadingMore,
          onPressed: isLoadingMore ? null : onLoadMore,
        ),
      ],
    ];
  }
}
