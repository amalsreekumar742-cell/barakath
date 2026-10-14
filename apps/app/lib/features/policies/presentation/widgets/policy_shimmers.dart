import 'package:flutter/material.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimens.dart';
import '../../../../core/widgets/shimmer_loading.dart';

/// Initial-load skeleton for the Policies list — the same grouped card the
/// loaded list renders in, so nothing shifts when the rows arrive.
class PolicyListShimmer extends StatelessWidget {
  const PolicyListShimmer({super.key});

  static const _rows = 4;

  @override
  Widget build(BuildContext context) {
    return ShimmerLoading(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(
          AppDimens.screenPadding,
          AppDimens.space4,
          AppDimens.screenPadding,
          0,
        ),
        child: Container(
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(AppDimens.radiusCard),
            border: Border.all(color: AppColors.hairline),
          ),
          child: Column(
            children: [
              for (var i = 0; i < _rows; i++) ...[
                const Padding(
                  padding: EdgeInsets.symmetric(
                    horizontal: AppDimens.space16,
                    vertical: 15,
                  ),
                  child: Row(
                    children: [
                      ShimmerBox(width: 20, height: 20, borderRadius: 6),
                      SizedBox(width: AppDimens.space12),
                      Expanded(child: ShimmerBox(height: 14)),
                      SizedBox(width: 72),
                    ],
                  ),
                ),
                if (i != _rows - 1)
                  const Divider(height: 1, thickness: 1, color: AppColors.hairline),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// Initial-load skeleton for one policy: the "Last updated" line, then
/// heading + paragraph shapes like the legal text that replaces it.
class PolicyDocumentShimmer extends StatelessWidget {
  const PolicyDocumentShimmer({super.key});

  @override
  Widget build(BuildContext context) {
    return const ShimmerLoading(
      child: Padding(
        padding: EdgeInsets.symmetric(horizontal: AppDimens.screenPadding),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ShimmerBox(width: 160, height: 12),
            SizedBox(height: AppDimens.space20),
            ShimmerBox(width: 200, height: 18),
            SizedBox(height: AppDimens.space16),
            ShimmerBox(width: double.infinity, height: 12),
            SizedBox(height: AppDimens.space10),
            ShimmerBox(width: double.infinity, height: 12),
            SizedBox(height: AppDimens.space10),
            ShimmerBox(width: 240, height: 12),
            SizedBox(height: AppDimens.space24),
            ShimmerBox(width: 170, height: 18),
            SizedBox(height: AppDimens.space16),
            ShimmerBox(width: double.infinity, height: 12),
            SizedBox(height: AppDimens.space10),
            ShimmerBox(width: double.infinity, height: 12),
            SizedBox(height: AppDimens.space10),
            ShimmerBox(width: 210, height: 12),
          ],
        ),
      ),
    );
  }
}
