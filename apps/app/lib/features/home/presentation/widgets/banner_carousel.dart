import 'package:carousel_slider/carousel_slider.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:smooth_page_indicator/smooth_page_indicator.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/widgets/cached_image.dart';
import '../../domain/entities/banner_item.dart';

/// The home banner carousel (spec §2.6): auto-scrolling, rounded, 2:1, with dot
/// indicators. Tapping routes by the banner's `linkType`, which the admin sets.
class BannerCarousel extends StatefulWidget {
  const BannerCarousel({super.key, required this.banners});

  final List<BannerItem> banners;

  @override
  State<BannerCarousel> createState() => _BannerCarouselState();
}

class _BannerCarouselState extends State<BannerCarousel> {
  int _current = 0;

  @override
  Widget build(BuildContext context) {
    final banners = widget.banners;
    if (banners.isEmpty) return const SizedBox.shrink();

    return Column(
      children: [
        CarouselSlider(
          options: CarouselOptions(
            aspectRatio: 2,
            viewportFraction: 1,
            autoPlay: banners.length > 1,
            autoPlayInterval: const Duration(seconds: 4),
            // A single banner must not loop — infinite scroll on one item makes
            // the dots and the swipe gesture behave as if there were more.
            enableInfiniteScroll: banners.length > 1,
            onPageChanged: (index, _) => setState(() => _current = index),
          ),
          items: [
            for (final banner in banners)
              GestureDetector(
                onTap: () => _open(context, banner),
                child: SizedBox(
                  width: double.infinity,
                  child: CachedImage(url: banner.image, borderRadius: 16),
                ),
              ),
          ],
        ),
        if (banners.length > 1) ...[
          const SizedBox(height: 10),
          AnimatedSmoothIndicator(
            activeIndex: _current,
            count: banners.length,
            effect: const ExpandingDotsEffect(
              dotHeight: 6,
              dotWidth: 6,
              expansionFactor: 3,
              spacing: 5,
              activeDotColor: AppColors.brandGreen,
              dotColor: AppColors.border,
            ),
          ),
        ],
      ],
    );
  }

  /// Banner navigation (spec §1.15 "Banner Navigation"): the admin picks a link
  /// type and the app resolves it. An unknown/None type is deliberately inert.
  Future<void> _open(BuildContext context, BannerItem banner) async {
    if (banner.linkValue.isEmpty) return;
    switch (banner.linkType) {
      case 'Product':
        context.push('/product/${banner.linkValue}');
      case 'Category':
        context.push('/product-listing?categoryId=${banner.linkValue}');
      case 'External':
        final uri = Uri.tryParse(banner.linkValue);
        if (uri == null) return;
        // External links leave the app entirely — an in-app webview would trap
        // the customer on a page the store doesn't control.
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      default:
        break;
    }
  }
}
