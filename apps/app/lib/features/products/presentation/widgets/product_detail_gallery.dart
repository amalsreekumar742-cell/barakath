import 'package:flutter/material.dart';
import 'package:smooth_page_indicator/smooth_page_indicator.dart';
import 'package:youtube_player_flutter/youtube_player_flutter.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/utils/youtube_url.dart';
import '../../../../core/widgets/cached_image.dart';

/// The square media carousel at the top of the Product Detail screen: swipeable
/// pages, dot indicator, a tappable thumbnail strip, the flash-sale badge and
/// the floating back / share / wishlist actions.
///
/// When the product carries a YouTube link the video rides along as the LAST
/// page, after every image, with a play-badged thumbnail of its own — the
/// arrangement shoppers already know from the big marketplaces.
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
    this.videoUrl,
    this.videoPlayer,
    this.videoController,
    this.onPlayVideo,
  });

  final List<String> images;
  final int selectedIndex;
  final ValueChanged<int> onIndexChanged;

  /// Fires only for image pages — the video page handles its own taps.
  final ValueChanged<int> onImageTap;
  final VoidCallback onShare;
  final VoidCallback onWishlistToggle;
  final bool isWishlisted;
  final bool showSaleBadge;

  /// `product.youtubeVideoLink`. A blank or unparseable link simply means no
  /// video page, so a bad paste in the admin degrades to today's behaviour
  /// rather than an error slide.
  final String? videoUrl;

  /// The built player, handed down by the page's [YoutubePlayerBuilder]. Null
  /// until the shopper taps play — the facade is shown until then.
  ///
  /// WHY the gallery does not build this itself: fullscreen swaps the player
  /// out of the page and renders it alone, so the widget has to be created
  /// above the Scaffold. See `_ProductDetailViewState._videoController`.
  final Widget? videoPlayer;

  /// The controller behind [videoPlayer], used only to pause on swipe-away.
  final YoutubePlayerController? videoController;

  /// Fires with the video id when the play button is tapped, asking the page to
  /// create the controller.
  final ValueChanged<String>? onPlayVideo;

  @override
  State<ProductDetailGallery> createState() => _ProductDetailGalleryState();
}

class _ProductDetailGalleryState extends State<ProductDetailGallery> {
  late final PageController _controller =
      PageController(initialPage: widget.selectedIndex);

  /// Resolved once — the regex should not run on every build.
  late String? _videoId = YoutubeUrl.extractId(widget.videoUrl ?? '');

  bool get _hasVideo => _videoId != null;

  /// Images plus the video page, when there is one.
  int get _pageCount => widget.images.length + (_hasVideo ? 1 : 0);

  bool _isVideoPage(int index) => _hasVideo && index == widget.images.length;

  @override
  void didUpdateWidget(covariant ProductDetailGallery oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.videoUrl != oldWidget.videoUrl) {
      _videoId = YoutubeUrl.extractId(widget.videoUrl ?? '');
    }
    // Swiping back to a photo pauses the video — audio must not keep playing
    // behind the product images.
    if (_isVideoPage(oldWidget.selectedIndex) &&
        !_isVideoPage(widget.selectedIndex)) {
      widget.videoController?.pause();
    }
    _syncPage(oldWidget);
  }

  void _syncPage(ProductDetailGallery oldWidget) {
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
    final pageCount = _pageCount;

    return Column(
      children: [
        Stack(
          children: [
            AspectRatio(
              aspectRatio: 1,
              child: Container(
                color: AppColors.subtle,
                child: pageCount == 0
                    ? const Center(
                        child: Icon(
                          Icons.image_not_supported_outlined,
                          size: 40,
                          color: AppColors.muted,
                        ),
                      )
                    : PageView.builder(
                        controller: _controller,
                        itemCount: pageCount,
                        onPageChanged: widget.onIndexChanged,
                        itemBuilder: (_, i) {
                          if (_isVideoPage(i)) {
                            return _VideoPage(
                              videoId: _videoId!,
                              player: widget.videoPlayer,
                              onPlay: () =>
                                  widget.onPlayVideo?.call(_videoId!),
                            );
                          }
                          return GestureDetector(
                            onTap: () => widget.onImageTap(i),
                            child: CachedImage(
                              url: images[i],
                              fit: BoxFit.cover,
                              width: double.infinity,
                            ),
                          );
                        },
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
            if (pageCount > 1)
              Positioned(
                bottom: 12,
                left: 0,
                right: 0,
                child: Center(
                  child: SmoothPageIndicator(
                    controller: _controller,
                    count: pageCount,
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
        if (pageCount > 1)
          SizedBox(
            height: 66,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              itemCount: pageCount,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (_, i) {
                final selected = i == widget.selectedIndex;
                final isVideo = _isVideoPage(i);
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
                    child: isVideo
                        ? _VideoThumb(videoId: _videoId!)
                        : CachedImage(
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

/// The video page of the carousel: YouTube's own still with a play button
/// until [player] arrives, then the player itself.
///
/// WHY a click-to-play facade rather than an embedded player from the start:
/// the player is a platform WebView costing far more than an image, and most
/// shoppers never swipe this far. Building it on tap keeps the product page's
/// first frame cheap — the same trade-off the customer website makes. It also
/// means no video ever starts on its own next to the product images.
class _VideoPage extends StatelessWidget {
  const _VideoPage({
    required this.videoId,
    required this.player,
    required this.onPlay,
  });

  final String videoId;

  /// Built by the page (above the Scaffold, so fullscreen can swap it out) and
  /// null until [onPlay] has been called.
  final Widget? player;

  final VoidCallback onPlay;

  @override
  Widget build(BuildContext context) {
    if (player != null) {
      // The carousel slot is 1:1 and the player is 16:9, so ~22% of the square
      // is backdrop above the video and ~22% below. That backdrop used to be
      // black, and because the gallery runs under the status bar (this screen
      // has no AppBar) the upper band read as the top of the phone going dead —
      // status bar icons vanished into it too. The gallery's own placeholder
      // colour keeps the letterbox reading as an inset video.
      return Container(
        color: AppColors.subtle,
        alignment: Alignment.center,
        child: player,
      );
    }

    return GestureDetector(
      onTap: onPlay,
      behavior: HitTestBehavior.opaque,
      child: Stack(
        fit: StackFit.expand,
        children: [
          // `hqdefault` rather than `maxresdefault`: the latter 404s for videos
          // that were never uploaded in HD, which would blank the page.
          CachedImage(
            url: 'https://img.youtube.com/vi/$videoId/hqdefault.jpg',
            fit: BoxFit.cover,
            width: double.infinity,
          ),
          Container(color: Colors.black.withValues(alpha: 0.25)),
          const Center(
            child: Icon(
              Icons.play_circle_fill_rounded,
              size: 64,
              color: Colors.white,
            ),
          ),
        ],
      ),
    );
  }
}

/// The video's entry in the thumbnail strip — the still with a play badge, so
/// it reads as a video and not as one more photo.
class _VideoThumb extends StatelessWidget {
  const _VideoThumb({required this.videoId});

  final String videoId;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(9),
      child: Stack(
        fit: StackFit.expand,
        children: [
          CachedImage(
            url: 'https://img.youtube.com/vi/$videoId/mqdefault.jpg',
            height: 50,
            width: 50,
          ),
          Container(color: Colors.black.withValues(alpha: 0.25)),
          const Center(
            child: Icon(
              Icons.play_arrow_rounded,
              size: 22,
              color: Colors.white,
            ),
          ),
        ],
      ),
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
