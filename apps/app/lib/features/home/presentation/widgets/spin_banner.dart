import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/constants/app_colors.dart';

/// The Spin & Win entry point on Home — a fixed promo, not Firestore-driven
/// content, so it always renders (unlike [BannerCarousel], which hides itself
/// when there are no admin banners). Matches the prototype's "08 · Home" frame
/// exactly: 115° bronze→gold→highlight gradient, a spoked-wheel glyph, and a
/// bare arrow (no chip behind it). Tapping routes to `/spin`, which is already
/// guest-gated in the router and shows its own "no campaign running" message
/// when nothing is live — so this banner never needs campaign-awareness.
class SpinBanner extends StatelessWidget {
  const SpinBanner({super.key});

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: () => context.push('/spin'),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              // ~115deg in CSS, i.e. mostly left-to-right with a slight downward tilt.
              begin: Alignment(-0.8, -0.5),
              end: Alignment(0.8, 0.5),
              stops: [0.0, 0.55, 1.0],
              colors: [
                AppColors.goldBronze,
                AppColors.cta,
                AppColors.goldHighlight,
              ],
            ),
            boxShadow: [
              BoxShadow(
                color: AppColors.cta.withValues(alpha: 0.34),
                blurRadius: 28,
                offset: const Offset(0, 12),
              ),
            ],
          ),
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              // Decorative glow — top-right radial highlight from the design.
              Positioned(
                top: -60,
                right: -30,
                child: IgnorePointer(
                  child: Container(
                    width: 150,
                    height: 150,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: RadialGradient(
                        colors: [
                          Colors.white.withValues(alpha: 0.28),
                          Colors.white.withValues(alpha: 0),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
              Row(
                children: [
                  const _SpokedWheelIcon(size: 58),
                  const SizedBox(width: 15),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          'SPIN & WIN',
                          style: TextStyle(
                            color: Colors.white.withValues(alpha: 0.85),
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 1.6,
                          ),
                        ),
                        const SizedBox(height: 3),
                        const Text(
                          'Feeling lucky today?',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 19,
                            fontWeight: FontWeight.w800,
                            letterSpacing: -0.38,
                          ),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          'Win coupons, cashback & more.',
                          style: TextStyle(
                            color: Colors.white.withValues(alpha: 0.82),
                            fontSize: 12,
                            height: 1.4,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 15),
                  const Icon(Icons.arrow_forward_rounded, color: Colors.white, size: 20),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The banner's glyph: a translucent ringed circle with 8 spokes and a white
/// hub with a gold centre dot — a literal small SVG in the prototype, redrawn
/// here since it isn't one of Flutter's built-in icons.
class _SpokedWheelIcon extends StatelessWidget {
  const _SpokedWheelIcon({required this.size});

  final double size;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: CustomPaint(painter: _SpokedWheelPainter()),
    );
  }
}

class _SpokedWheelPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    // Drawn at the prototype's 60x60 viewBox, then scaled to the widget size.
    canvas.save();
    canvas.scale(size.width / 60, size.height / 60);
    final center = const Offset(30, 30);

    canvas.drawCircle(
      center,
      27,
      Paint()..color = Colors.white.withValues(alpha: 0.18),
    );
    canvas.drawCircle(
      center,
      27,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2
        ..color = Colors.white.withValues(alpha: 0.5),
    );

    final spokePaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5
      ..color = Colors.white.withValues(alpha: 0.45);
    for (var i = 0; i < 4; i++) {
      final angle = i * math.pi / 4;
      final dx = math.cos(angle) * 26;
      final dy = math.sin(angle) * 26;
      canvas.drawLine(center - Offset(dx, dy), center + Offset(dx, dy), spokePaint);
    }

    canvas.drawCircle(center, 7, Paint()..color = Colors.white);
    canvas.drawCircle(center, 3, Paint()..color = AppColors.cta);
    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant _SpokedWheelPainter oldDelegate) => false;
}
