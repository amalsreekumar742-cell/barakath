import 'dart:async';

import 'package:flutter/material.dart';

import '../constants/app_colors.dart';

/// A live HH:MM:SS countdown chip to [endDate], used by the home flash-sale
/// header (design: red text on a tinted red chip).
///
/// WHY stateful with its own timer: the remaining time changes every second but
/// nothing else on the page does — ticking here keeps the rebuild scoped to this
/// chip instead of the whole home tree. The timer is cancelled in [dispose] and
/// stops itself once the sale has ended, so an expired sale left on screen
/// doesn't keep waking the framework.
class FlashSaleCountdown extends StatefulWidget {
  const FlashSaleCountdown({
    super.key,
    required this.endDate,
    this.fontSize = 12,
  });

  final DateTime endDate;
  final double fontSize;

  @override
  State<FlashSaleCountdown> createState() => _FlashSaleCountdownState();
}

class _FlashSaleCountdownState extends State<FlashSaleCountdown> {
  Timer? _timer;
  late Duration _remaining;

  @override
  void initState() {
    super.initState();
    _remaining = _remainingFrom(widget.endDate);
    _startTicking();
  }

  @override
  void didUpdateWidget(covariant FlashSaleCountdown oldWidget) {
    super.didUpdateWidget(oldWidget);
    // A refresh can hand us a different sale — re-arm against the new deadline.
    if (oldWidget.endDate != widget.endDate) {
      _remaining = _remainingFrom(widget.endDate);
      _startTicking();
    }
  }

  Duration _remainingFrom(DateTime end) {
    final diff = end.difference(DateTime.now());
    return diff.isNegative ? Duration.zero : diff;
  }

  void _startTicking() {
    _timer?.cancel();
    if (_remaining == Duration.zero) return;
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      final next = _remainingFrom(widget.endDate);
      if (next == Duration.zero) _timer?.cancel();
      if (mounted) setState(() => _remaining = next);
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  String get _label {
    if (_remaining == Duration.zero) return 'Ended';
    // Hours are NOT wrapped at 24 — a two-day sale should read "48:00:00"
    // rather than silently restarting the clock.
    final hours = _remaining.inHours;
    final minutes = _remaining.inMinutes % 60;
    final seconds = _remaining.inSeconds % 60;
    return '${_two(hours)}:${_two(minutes)}:${_two(seconds)}';
  }

  String _two(int value) => value.toString().padLeft(2, '0');

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(
        color: AppColors.danger.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        _label,
        style: TextStyle(
          color: AppColors.danger,
          fontSize: widget.fontSize,
          fontWeight: FontWeight.w800,
          fontFeatures: const [FontFeature.tabularFigures()],
        ),
      ),
    );
  }
}
