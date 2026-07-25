import 'package:flutter/material.dart';

import '../../../../core/widgets/shimmer_loading.dart';

/// The home screen's first-load placeholder (skill: "Loading State Policy" —
/// content loads show a skeleton shaped like the real layout, never a bare
/// spinner). Mirrors banner → categories → product row → grid.
class HomeSkeleton extends StatelessWidget {
  const HomeSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return const ShimmerLoading(
      child: Padding(
        padding: EdgeInsets.fromLTRB(16, 8, 16, 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            AspectRatio(
              aspectRatio: 2,
              child: ShimmerBox(
                width: double.infinity,
                height: double.infinity,
                borderRadius: 16,
              ),
            ),
            // Mirrors the real section order — flash sale, new arrivals, then
            // the per-category rows. A skeleton that shows a different shape
            // makes the content visibly jump when it lands.
            SizedBox(height: 24),
            ShimmerBox(width: 130, height: 18),
            SizedBox(height: 14),
            _ProductRowSkeleton(),
            SizedBox(height: 24),
            ShimmerBox(width: 150, height: 18),
            SizedBox(height: 14),
            _ProductRowSkeleton(),
            SizedBox(height: 24),
            ShimmerBox(width: 110, height: 18),
            SizedBox(height: 14),
            _ProductRowSkeleton(),
          ],
        ),
      ),
    );
  }
}

// NOTE: the circular category-tile skeletons were removed with the "Shop by
// category" strip — home now renders a product row per category instead, which
// _ProductRowSkeleton already covers.

class _ProductRowSkeleton extends StatelessWidget {
  const _ProductRowSkeleton();

  @override
  Widget build(BuildContext context) {
    // Three cards are wider than a phone — the scroll view clips the overflow
    // the same way the real row does, instead of throwing a layout error.
    return const SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      physics: NeverScrollableScrollPhysics(),
      child: Row(
        children: [
          _ProductCardSkeleton(),
          SizedBox(width: 12),
          _ProductCardSkeleton(),
          SizedBox(width: 12),
          _ProductCardSkeleton(),
        ],
      ),
    );
  }
}

class _ProductCardSkeleton extends StatelessWidget {
  const _ProductCardSkeleton();

  @override
  Widget build(BuildContext context) {
    // 150 wide with a 128 image — the real ProductCard's dimensions, so the
    // shimmer doesn't resize the moment content lands.
    return const SizedBox(
      width: 150,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ShimmerBox(width: 150, height: 128, borderRadius: 12),
          SizedBox(height: 8),
          ShimmerBox(width: 110, height: 11),
          SizedBox(height: 6),
          ShimmerBox(width: 70, height: 11),
        ],
      ),
    );
  }
}
