import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../constants/app_colors.dart';
import 'shimmer_loading.dart';

/// A network image with a shimmer placeholder while loading and an
/// "image-off" fallback on error. An empty/blank [url] renders the fallback
/// directly (no network request).
class CachedImage extends StatelessWidget {
  const CachedImage({
    super.key,
    required this.url,
    this.width,
    this.height,
    this.fit = BoxFit.cover,
    this.borderRadius = 0,
  });

  final String url;
  final double? width;
  final double? height;
  final BoxFit fit;
  final double borderRadius;

  @override
  Widget build(BuildContext context) {
    final radius = BorderRadius.circular(borderRadius);

    final Widget content = url.trim().isEmpty
        ? _fallback()
        : CachedNetworkImage(
            imageUrl: url,
            width: width,
            height: height,
            fit: fit,
            placeholder: (_, __) => _placeholder(),
            errorWidget: (_, __, ___) => _fallback(),
          );

    return ClipRRect(borderRadius: radius, child: content);
  }

  Widget _placeholder() {
    return ShimmerLoading(
      child: Container(
        width: width,
        height: height,
        color: AppColors.subtle,
      ),
    );
  }

  Widget _fallback() {
    return Container(
      width: width,
      height: height,
      color: AppColors.subtle,
      alignment: Alignment.center,
      child: const Icon(
        Icons.image_not_supported_outlined,
        color: AppColors.muted,
        size: 32,
      ),
    );
  }
}
