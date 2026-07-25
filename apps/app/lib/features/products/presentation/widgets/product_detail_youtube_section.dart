import 'package:flutter/material.dart';
import 'package:youtube_player_flutter/youtube_player_flutter.dart';

import '../../../../core/constants/app_colors.dart';

/// The product video, embedded with `youtube_player_flutter`.
///
/// WHY it initialises lazily: the player spins up a platform WebView, which is
/// expensive and would stall the first frame of every product page even for the
/// majority of shoppers who never scroll this far. The controller is therefore
/// created only once the section actually enters the viewport, and disposed with
/// the widget so no WebView is left running after a back navigation.
class ProductDetailYoutubeSection extends StatefulWidget {
  const ProductDetailYoutubeSection({super.key, required this.videoUrl});

  final String videoUrl;

  @override
  State<ProductDetailYoutubeSection> createState() =>
      _ProductDetailYoutubeSectionState();
}

class _ProductDetailYoutubeSectionState
    extends State<ProductDetailYoutubeSection> {
  ScrollPosition? _scrollPosition;
  YoutubePlayerController? _controller;
  String? _videoId;

  @override
  void initState() {
    super.initState();
    _videoId = YoutubePlayer.convertUrlToId(widget.videoUrl);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final position = Scrollable.maybeOf(context)?.position;
    if (position != _scrollPosition) {
      _scrollPosition?.removeListener(_maybeActivate);
      _scrollPosition = position;
      _scrollPosition?.addListener(_maybeActivate);
    }
    // Covers the case where the section is already on screen at first layout
    // (short pages), which produces no scroll notification.
    WidgetsBinding.instance.addPostFrameCallback((_) => _maybeActivate());
  }

  @override
  void dispose() {
    _scrollPosition?.removeListener(_maybeActivate);
    _controller?.dispose();
    super.dispose();
  }

  void _maybeActivate() {
    if (!mounted || _controller != null || _videoId == null) return;
    final box = context.findRenderObject() as RenderBox?;
    if (box == null || !box.hasSize) return;

    final top = box.localToGlobal(Offset.zero).dy;
    final viewportHeight = MediaQuery.of(context).size.height;
    final isVisible = top < viewportHeight && top + box.size.height > 0;
    if (!isVisible) return;

    setState(() {
      _controller = YoutubePlayerController(
        initialVideoId: _videoId!,
        flags: const YoutubePlayerFlags(autoPlay: false, mute: false),
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    // An unparseable link is treated as "no video" rather than an error row.
    if (_videoId == null) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Product video',
            style: TextStyle(
              color: AppColors.textPrimary,
              fontSize: 15,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 10),
          ClipRRect(
            borderRadius: BorderRadius.circular(14),
            child: AspectRatio(
              aspectRatio: 16 / 9,
              child: _controller == null
                  ? Container(
                      color: AppColors.subtle,
                      alignment: Alignment.center,
                      child: const Icon(
                        Icons.play_circle_outline_rounded,
                        size: 44,
                        color: AppColors.muted,
                      ),
                    )
                  : YoutubePlayer(
                      controller: _controller!,
                      showVideoProgressIndicator: true,
                      progressIndicatorColor: AppColors.cta,
                    ),
            ),
          ),
        ],
      ),
    );
  }
}
