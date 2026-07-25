import 'package:flutter/material.dart';
import 'package:smooth_page_indicator/smooth_page_indicator.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/widgets/cached_image.dart';

/// The square image carousel at the top of the Product Detail screen: swipeable
/// pages, dot indicator, a tappable thumbnail strip, the flash-sale badge and
/// the floating back / share / wishlist actions.
///
/// The page controller is owned here but driven from the provider's selected
/// index, so tapping a thumbnail and swiping stay in sync in both directions.
class ProductDetailGallery extends StatefulWidget {
  const ProductDetailGallery({
    super.key,
    required this.images,
    required this.selectedIndex,
    required this.onIndexChanged,
    required this.onImageTap,
    required this.onShare,
    required this.onWishlistToggle,
    required this.isWishlisted,
    required this.showSaleBadge,
  });

  final List<String> images;
  final int selectedIndex;
  final ValueChanged<int> onIndexChanged;
  final ValueChanged<int> onImageTap;
  final VoidCallback onShare;
  final VoidCallback onWishlistToggle;
  final bool isWishlisted;
  final bool showSaleBadge;

  @override
  State<ProductDetailGallery> createState() => _ProductDetailGalleryState();
}

class _ProductDetailGalleryState extends State<ProductDetailGallery> {
  late final PageController _controller =
      PageController(initialPage: widget.selectedIndex);

  @override
  void didUpdateWidget(covariant ProductDetailGallery oldWidget) {
    super.didUpdateWidget(oldWidget);
    // A thumbnail tap (or a variant switch) changes the index outside the
    // PageView — animate the carousel to match instead of letting the two drift.
    if (widget.selectedIndex != oldWidget.selectedIndex &&
        _controller.hasClients &&
        _controller.page?.round() != widget.selectedIndex) {
      _controller.animateToPage(
        widget.selectedIndex,
        duration: const Duration(milliseconds: 220),
        curve: Curves.easeOut,
      );
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final images = widget.images;

    return Column(
      children: [
        Stack(
          children: [
            AspectRatio(
              aspectRatio: 1,
              child: Container(
                color: AppColors.subtle,
                child: images.isEmpty
                    ? const Center(
                        child: Icon(
                          Icons.image_not_supported_outlined,
                          size: 40,
                          color: AppColors.muted,
                        ),
                      )
                    : PageView.builder(
                        controller: _controller,
                        itemCount: images.length,
                        onPageChanged: widget.onIndexChanged,
                        itemBuilder: (_, i) => GestureDetector(
                          onTap: () => widget.onImageTap(i),
                          child: CachedImage(
                            url: images[i],
                            fit: BoxFit.cover,
                            width: double.infinity,
                          ),
                        ),
                      ),
              ),
            ),
            // The gallery sits under the status bar (there is no AppBar), so
            // the overlays are pushed down by the system inset manually.
            if (widget.showSaleBadge)
              Positioned(
                top: MediaQuery.paddingOf(context).top + 56,
                left: 12,
                child: const _SaleBadge(),
              ),
            Positioned(
              top: MediaQuery.paddingOf(context).top + 8,
              right: 12,
              child: Row(
                children: [
                  _GalleryAction(
                    icon: Icons.ios_share_rounded,
                    onTap: widget.onShare,
                  ),
                  const SizedBox(width: 8),
                  _GalleryAction(
                    icon: widget.isWishlisted
                        ? Icons.favorite_rounded
                        : Icons.favorite_border_rounded,
                    color: widget.isWishlisted ? AppColors.danger : null,
                    onTap: widget.onWishlistToggle,
                  ),
                ],
              ),
            ),
            if (images.length > 1)
              Positioned(
                bottom: 12,
                left: 0,
                right: 0,
                child: Center(
                  child: SmoothPageIndicator(
                    controller: _controller,
                    count: images.length,
                    effect: const ExpandingDotsEffect(
                      dotHeight: 6,
                      dotWidth: 6,
                      expansionFactor: 4,
                      spacing: 6,
                      dotColor: AppColors.border,
                      activeDotColor: AppColors.brandGreen,
                    ),
                  ),
                ),
              ),
          ],
        ),
        if (images.length > 1)
          SizedBox(
            height: 66,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              itemCount: images.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (_, i) {
                final selected = i == widget.selectedIndex;
                return GestureDetector(
                  onTap: () => widget.onIndexChanged(i),
                  child: Container(
                    height: 50,
                    width: 50,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(
                        color: selected ? AppColors.ink : AppColors.border,
                        width: selected ? 1.6 : 1,
                      ),
                    ),
                    child: CachedImage(
                      url: images[i],
                      height: 50,
                      width: 50,
                      borderRadius: 9,
                    ),
                  ),
                );
              },
            ),
          ),
      ],
    );
  }
}

class _SaleBadge extends StatelessWidget {
  const _SaleBadge();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: AppColors.danger,
        borderRadius: BorderRadius.circular(8),
      ),
      child: const Text(
        'SALE',
        style: TextStyle(
          color: Colors.white,
          fontSize: 11,
          fontWeight: FontWeight.w800,
          letterSpacing: 0.6,
        ),
      ),
    );
  }
}

class _GalleryAction extends StatelessWidget {
  const _GalleryAction({required this.icon, required this.onTap, this.color});

  final IconData icon;
  final VoidCallback onTap;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.surface.withValues(alpha: 0.92),
      shape: const CircleBorder(),
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: onTap,
        child: SizedBox(
          height: 40,
          width: 40,
          child: Icon(icon, size: 20, color: color ?? AppColors.ink),
        ),
      ),
    );
  }
}
