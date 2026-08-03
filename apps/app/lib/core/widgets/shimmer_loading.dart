import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';

import '../constants/app_colors.dart';

/// Reusable shimmer loading placeholders for the Barakath app.
///
/// Per the "Loading State Policy": content loads use shimmer skeletons, never a
/// bare centered spinner. These widgets shape the real layout so the skeleton
/// stays close to the loaded UI.
///
/// Use [ShimmerLoading] as the base wrapper for any custom placeholder shape,
/// or the pre-built [ShimmerCard], [ShimmerListTile], [ShimmerGrid] and
/// [ShimmerProductCard] for common cases.
class ShimmerLoading extends StatelessWidget {
  const ShimmerLoading({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Shimmer.fromColors(
      baseColor: AppColors.subtle,
      highlightColor: AppColors.surface,
      child: child,
    );
  }
}

/// A single shimmer "box" primitive used to compose skeleton layouts.
class ShimmerBox extends StatelessWidget {
  const ShimmerBox({
    super.key,
    this.width,
    this.height = 12,
    this.borderRadius = 8,
  });

  final double? width;
  final double height;
  final double borderRadius;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: AppColors.subtle,
        borderRadius: BorderRadius.circular(borderRadius),
      ),
    );
  }
}

/// A generic card-shaped skeleton: image block on top, two text lines below.
class ShimmerCard extends StatelessWidget {
  const ShimmerCard({super.key, this.height = 120});

  /// Height of the IMAGE block only — the card renders 70px taller than this
  /// (12+12 padding, 2 border, and 44 for the two text lines and their gaps).
  /// Inside a fixed-height slot (a grid's `mainAxisExtent`) pass
  /// `slotHeight - 70`, not the slot height, or the Column overflows.
  final double height;

  @override
  Widget build(BuildContext context) {
    return ShimmerLoading(
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ShimmerBox(height: height, borderRadius: 12, width: double.infinity),
            const SizedBox(height: 12),
            const ShimmerBox(width: 160, height: 12),
            const SizedBox(height: 8),
            const ShimmerBox(width: 100, height: 12),
          ],
        ),
      ),
    );
  }
}

/// A list-row skeleton: leading square thumbnail + two stacked text lines.
class ShimmerListTile extends StatelessWidget {
  const ShimmerListTile({super.key});

  @override
  Widget build(BuildContext context) {
    return const ShimmerLoading(
      child: Padding(
        padding: EdgeInsets.symmetric(vertical: 10, horizontal: 4),
        child: Row(
          children: [
            ShimmerBox(width: 56, height: 56, borderRadius: 12),
            SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  ShimmerBox(width: double.infinity, height: 12),
                  SizedBox(height: 8),
                  ShimmerBox(width: 140, height: 12),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// A grid of [ShimmerProductCard] skeletons for grid/catalog loading states.
class ShimmerGrid extends StatelessWidget {
  const ShimmerGrid({
    super.key,
    this.crossAxisCount = 2,
    this.itemCount = 6,
    this.padding = const EdgeInsets.all(16),
    this.childAspectRatio = 0.7,
  });

  final int crossAxisCount;
  final int itemCount;
  final EdgeInsetsGeometry padding;
  final double childAspectRatio;

  @override
  Widget build(BuildContext context) {
    return GridView.builder(
      padding: padding,
      physics: const NeverScrollableScrollPhysics(),
      shrinkWrap: true,
      itemCount: itemCount,
      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: crossAxisCount,
        crossAxisSpacing: 12,
        mainAxisSpacing: 12,
        childAspectRatio: childAspectRatio,
      ),
      itemBuilder: (_, __) => const ShimmerProductCard(),
    );
  }
}

/// A product-card skeleton: image block, title lines and a price line.
class ShimmerProductCard extends StatelessWidget {
  const ShimmerProductCard({super.key});

  @override
  Widget build(BuildContext context) {
    return ShimmerLoading(
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.border),
        ),
        child: const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: ShimmerBox(
                width: double.infinity,
                height: double.infinity,
                borderRadius: 16,
              ),
            ),
            Padding(
              padding: EdgeInsets.all(10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  ShimmerBox(width: double.infinity, height: 11),
                  SizedBox(height: 8),
                  ShimmerBox(width: 90, height: 11),
                  SizedBox(height: 12),
                  ShimmerBox(width: 60, height: 14),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
