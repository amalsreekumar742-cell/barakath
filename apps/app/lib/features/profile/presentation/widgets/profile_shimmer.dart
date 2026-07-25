import 'package:flutter/material.dart';

import '../../../../core/constants/app_dimens.dart';
import '../../../../core/widgets/shimmer_loading.dart';

/// Skeleton for the profile screen while `users/{uid}` loads: avatar + name
/// block, then two menu cards shaped like the real ones (spec §2.25 — every
/// load shows a skeleton, never a bare spinner).
class ProfileShimmer extends StatelessWidget {
  const ProfileShimmer({super.key});

  @override
  Widget build(BuildContext context) {
    return ShimmerLoading(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(
          AppDimens.screenPadding,
          AppDimens.space12,
          AppDimens.screenPadding,
          AppDimens.space20,
        ),
        children: const [
          Row(
            children: [
              ShimmerBox(width: 64, height: 64, borderRadius: 32),
              SizedBox(width: AppDimens.space14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    ShimmerBox(width: 150, height: 18),
                    SizedBox(height: AppDimens.space8),
                    ShimmerBox(width: 190, height: 12),
                  ],
                ),
              ),
            ],
          ),
          SizedBox(height: AppDimens.space20),
          ShimmerBox(width: double.infinity, height: 210, borderRadius: 12),
          SizedBox(height: AppDimens.gapCards),
          ShimmerBox(width: double.infinity, height: 158, borderRadius: 12),
        ],
      ),
    );
  }
}
