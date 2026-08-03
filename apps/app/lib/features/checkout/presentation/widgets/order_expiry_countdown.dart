import 'dart:async';

import 'package:flutter/material.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimens.dart';

/// How long an unpaid order survives before it is auto-cancelled and its items
/// go back to stock.
///
/// MUST match `ORDER_PAYMENT_TIMEOUT_MINUTES` in
/// `packages/shared/src/config/orderTimeout.ts` and
/// `functions/src/orders/service/orderTimeout.ts`, which is what actually
/// cancels the order. A countdown that disagrees with the server is worse than
/// no countdown: it either promises time the customer does not have, or expires
/// while the order is still payable.
const int kOrderPaymentTimeoutMinutes = 10;

/// OrderExpiryCountdown — "Complete payment within MM:SS or this order is
/// cancelled", counting down from the order's own `createdAt`.
///
/// WHY the customer is told: checkout reserves stock BEFORE payment, so an
/// unpaid order holds inventory; `expireUnpaidOrders` reclaims it after the
/// window. Retry re-opens Razorpay against the SAME order, so the deadline is
/// real and directly actionable here — it is the difference between a retry
/// that can succeed and one that cannot.
///
/// WHY it recomputes from `DateTime.now()` each tick rather than decrementing:
/// a backgrounded app pauses timers, and a decremented counter would drift into
/// showing time the customer no longer has.
class OrderExpiryCountdown extends StatefulWidget {
  const OrderExpiryCountdown({
    super.key,
    required this.createdAt,
    this.onExpired,
  });

  /// The ORDER's creation time — never `DateTime.now()`, or reopening the page
  /// would hand the customer a fresh 10 minutes that the server will not honour.
  final DateTime createdAt;

  /// Fired once when the window closes, so the caller can disable Retry.
  final VoidCallback? onExpired;

  @override
  State<OrderExpiryCountdown> createState() => _OrderExpiryCountdownState();
}

class _OrderExpiryCountdownState extends State<OrderExpiryCountdown> {
  Timer? _timer;
  late Duration _remaining;
  bool _notified = false;

  @override
  void initState() {
    super.initState();
    _remaining = _remainingFrom(widget.createdAt);
    if (_remaining > Duration.zero) {
      _timer = Timer.periodic(const Duration(seconds: 1), (_) => _tick());
    } else {
      _scheduleExpiredCallback();
    }
  }

  @override
  void didUpdateWidget(covariant OrderExpiryCountdown oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.createdAt != widget.createdAt) {
      _timer?.cancel();
      _notified = false;
      _remaining = _remainingFrom(widget.createdAt);
      if (_remaining > Duration.zero) {
        _timer = Timer.periodic(const Duration(seconds: 1), (_) => _tick());
      } else {
        _scheduleExpiredCallback();
      }
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Duration _remainingFrom(DateTime createdAt) {
    final deadline =
        createdAt.add(const Duration(minutes: kOrderPaymentTimeoutMinutes));
    final left = deadline.difference(DateTime.now());
    return left.isNegative ? Duration.zero : left;
  }

  void _tick() {
    final next = _remainingFrom(widget.createdAt);
    if (!mounted) return;
    setState(() => _remaining = next);
    if (next == Duration.zero) {
      _timer?.cancel();
      _scheduleExpiredCallback();
    }
  }

  /// Deferred a frame: `onExpired` typically calls setState on the parent, which
  /// is illegal during this widget's own build/init.
  void _scheduleExpiredCallback() {
    if (_notified) return;
    _notified = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) widget.onExpired?.call();
    });
  }

  @override
  Widget build(BuildContext context) {
    final expired = _remaining == Duration.zero;
    final minutes = _remaining.inMinutes.toString().padLeft(2, '0');
    final seconds = (_remaining.inSeconds % 60).toString().padLeft(2, '0');

    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppDimens.space12,
        vertical: AppDimens.space10,
      ),
      decoration: BoxDecoration(
        // `warning` itself (#FFDB43) is a bright yellow that only works as a fill;
        // the icon uses goldStrong so it stays legible on it.
        color: expired ? AppColors.surfaceSubtle : AppColors.warningSubtle,
        borderRadius: BorderRadius.circular(AppDimens.radiusMd),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            expired ? Icons.info_outline : Icons.schedule_outlined,
            size: 16,
            color:
                expired ? AppColors.textSecondary : AppColors.goldStrong,
          ),
          const SizedBox(width: AppDimens.space8),
          Expanded(
            child: expired
                ? const Text(
                    'This order has been cancelled and your items returned to '
                    'stock. Place a new order to try again.',
                    style: TextStyle(
                      fontSize: 12,
                      height: 1.4,
                      color: AppColors.textSecondary,
                    ),
                  )
                : Text.rich(
                    TextSpan(
                      children: [
                        const TextSpan(text: 'Complete payment within '),
                        TextSpan(
                          text: '$minutes:$seconds',
                          style: const TextStyle(
                            fontWeight: FontWeight.w800,
                            fontFeatures: [FontFeature.tabularFigures()],
                          ),
                        ),
                        const TextSpan(
                          text: ' or this order is cancelled and your items '
                              'released.',
                        ),
                      ],
                    ),
                    style: const TextStyle(
                      fontSize: 12,
                      height: 1.4,
                      color: AppColors.textPrimary,
                    ),
                  ),
          ),
        ],
      ),
    );
  }
}
