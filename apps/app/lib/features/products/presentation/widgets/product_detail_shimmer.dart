import 'package:flutter/material.dart';

import '../../../../core/widgets/shimmer_loading.dart';

/// Full-page skeleton for the Product Detail screen, shaped like the loaded
/// layout (square gallery → title → price → chips → paragraph) so the content
/// doesn't jump when it lands.
class ProductDetailShimmer extends StatelessWidget {
  const ProductDetailShimmer({super.key});

  @override
  Widget build(BuildContext context) {
    return const SingleChildScrollView(
      physics: NeverScrollableScrollPhysics(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AspectRatio(
            aspectRatio: 1,
            child: ShimmerLoading(
              child: ShimmerBox(
                width: double.infinity,
                height: double.infinity,
                borderRadius: 0,
              ),
            ),
          ),
          SizedBox(height: 16),
          Padding(
            padding: EdgeInsets.symmetric(horizontal: 16),
            child: ShimmerLoading(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  ShimmerBox(width: double.infinity, height: 18),
                  SizedBox(height: 10),
                  ShimmerBox(width: 180, height: 18),
                  SizedBox(height: 18),
                  ShimmerBox(width: 120, height: 22),
                  SizedBox(height: 18),
                  Row(
                    children: [
                      ShimmerBox(width: 90, height: 40, borderRadius: 12),
                      SizedBox(width: 10),
                      ShimmerBox(width: 90, height: 40, borderRadius: 12),
                      SizedBox(width: 10),
                      ShimmerBox(width: 90, height: 40, borderRadius: 12),
                    ],
                  ),
                  SizedBox(height: 22),
                  ShimmerBox(width: double.infinity, height: 12),
                  SizedBox(height: 8),
                  ShimmerBox(width: double.infinity, height: 12),
                  SizedBox(height: 8),
                  ShimmerBox(width: 220, height: 12),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
