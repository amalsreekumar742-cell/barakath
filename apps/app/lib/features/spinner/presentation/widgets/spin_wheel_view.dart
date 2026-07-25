import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../../core/constants/app_colors.dart';
import '../../domain/entities/spinner_campaign.dart';

/// The prize wheel: one wedge per campaign slot, a fixed pointer at 12 o'clock,
/// and a hub cap.
///
/// [rotation] is driven from outside (an AnimationController on the page) so the
/// widget stays dumb: it draws the wheel at whatever angle it is handed and has
/// no opinion about where it should stop. The landing wedge is the server's
/// answer — see `SpinPage`.
class SpinWheelView extends StatelessWidget {
  const SpinWheelView({
    super.key,
    required this.slots,
    required this.rotation,
    this.diameter = 260,
  });

  final List<SpinnerSlot> slots;

  /// Current wheel angle in radians, clockwise.
  final double rotation;
  final double diameter;

  /// Wedge fills, cycled. Taken from the prototype's conic gradient
  /// (green / deep green / gold / gold-strong) rather than the slot's own hex,
  /// so an admin colour choice can never produce an unreadable wheel.
  static const List<Color> _wedgeColors = [
    AppColors.brandGreen,
    AppColors.brandGreenDark,
    AppColors.cta,
    AppColors.goldStrong,
  ];

  /// The fill for wedge [index] of [count], nudged so the last wedge never
  /// lands on the same colour as the first one it touches.
  static Color wedgeColor(int index, int count) {
    var colorIndex = index % _wedgeColors.length;
    if (count > 1 && index == count - 1 && colorIndex == 0) {
      colorIndex = (colorIndex + 1) % _wedgeColors.length;
    }
    return _wedgeColors[colorIndex];
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: diameter,
      height: diameter + 12,
      child: Stack(
        alignment: Alignment.topCenter,
        children: [
          Positioned(
            top: 12,
            child: Transform.rotate(
              angle: rotation,
              child: Container(
                width: diameter,
                height: diameter,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(color: AppColors.cta, width: 8),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.4),
                      blurRadius: 50,
                      offset: const Offset(0, 20),
                    ),
                  ],
                ),
                child: CustomPaint(
                  painter: _WheelPainter(slots: slots),
                  size: Size.square(diameter),
                ),
              ),
            ),
          ),

          // Hub cap — sits above the wedges and does not rotate, so the gift
          // mark stays upright throughout the spin.
          Positioned(
            top: 12 + (diameter - 60) / 2,
            child: Container(
              width: 60,
              height: 60,
              decoration: BoxDecoration(
                color: AppColors.surface,
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.3),
                    blurRadius: 12,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: const Icon(
                Icons.card_giftcard_rounded,
                size: 26,
                color: AppColors.goldStrong,
              ),
            ),
          ),

          // The pointer is OUTSIDE the rotating subtree: it marks the winning
          // position, so it must stay put while the wheel turns under it.
          const Positioned(top: 0, child: _WheelPointer()),
        ],
      ),
    );
  }
}

class _WheelPointer extends StatelessWidget {
  const _WheelPointer();

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      size: const Size(28, 22),
      painter: _PointerPainter(),
    );
  }
}

class _PointerPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = AppColors.cta;
    final path = Path()
      ..moveTo(0, 0)
      ..lineTo(size.width, 0)
      ..lineTo(size.width / 2, size.height)
      ..close();
    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant _PointerPainter oldDelegate) => false;
}

class _WheelPainter extends CustomPainter {
  const _WheelPainter({required this.slots});

  final List<SpinnerSlot> slots;

  @override
  void paint(Canvas canvas, Size size) {
    if (slots.isEmpty) return;

    final radius = math.min(size.width, size.height) / 2;
    final center = Offset(size.width / 2, size.height / 2);
    final rect = Rect.fromCircle(center: center, radius: radius);
    final sweep = 2 * math.pi / slots.length;

    // Wedge 0 starts at 12 o'clock and they run clockwise — the same geometry
    // the landing angle is computed from on the page.
    const startAngle = -math.pi / 2;

    for (var i = 0; i < slots.length; i++) {
      final paint = Paint()
        ..style = PaintingStyle.fill
        ..color = SpinWheelView.wedgeColor(i, slots.length);
      canvas.drawArc(rect, startAngle + i * sweep, sweep, true, paint);
    }

    // Hairlines between wedges, drawn after the fills so none is half-covered.
    final divider = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5
      ..color = Colors.white.withValues(alpha: 0.2);
    for (var i = 0; i < slots.length; i++) {
      final angle = startAngle + i * sweep;
      canvas.drawLine(
        center,
        center + Offset(math.cos(angle), math.sin(angle)) * radius,
        divider,
      );
    }

    for (var i = 0; i < slots.length; i++) {
      _paintLabel(
        canvas: canvas,
        center: center,
        radius: radius,
        angle: startAngle + (i + 0.5) * sweep,
        text: slots[i].rewardText,
        maxWidth: radius * 0.6,
      );
    }
  }

  /// Draws one wedge's label along its radius, flipped on the left half so it
  /// never reads upside down.
  void _paintLabel({
    required Canvas canvas,
    required Offset center,
    required double radius,
    required double angle,
    required String text,
    required double maxWidth,
  }) {
    final painter = TextPainter(
      text: TextSpan(
        text: text,
        style: TextStyle(
          color: Colors.white,
          fontSize: 11,
          fontWeight: FontWeight.w800,
          height: 1.1,
          shadows: [
            Shadow(
              color: Colors.black.withValues(alpha: 0.4),
              blurRadius: 2,
              offset: const Offset(0, 1),
            ),
          ],
        ),
      ),
      textAlign: TextAlign.center,
      textDirection: TextDirection.ltr,
      maxLines: 2,
      ellipsis: '…',
    )..layout(maxWidth: maxWidth);

    final flip = math.cos(angle) < 0;

    canvas
      ..save()
      ..translate(center.dx, center.dy)
      ..rotate(flip ? angle + math.pi : angle)
      ..translate(flip ? -radius * 0.6 : radius * 0.6, 0);
    painter.paint(canvas, Offset(-painter.width / 2, -painter.height / 2));
    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant _WheelPainter oldDelegate) =>
      oldDelegate.slots != slots;
}
