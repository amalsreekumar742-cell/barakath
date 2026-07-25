import 'package:flutter/material.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimens.dart';
import '../../../../core/constants/domain_enums.dart';
import '../../domain/entities/order.dart';
import 'order_format.dart';

/// The SIX-step vertical tracking timeline (spec §2.17):
/// Pending → Accepted → Packed → Shipped → Out for delivery → Delivered.
///
/// The prototype only draws four steps; the spec wins (design map §4 conflict
/// 12). Each step's timestamp is derived from the order's `statusTimeline`
/// array — the deployed schema has no per-status date columns.
class TrackingTimeline extends StatelessWidget {
  const TrackingTimeline({super.key, required this.order});

  final Order order;

  static const double _dot = 20;
  static const double _rowGap = AppDimens.space20;

  @override
  Widget build(BuildContext context) {
    final current = OrderStatusX.from(order.status);
    final steps = OrderStatusX.timeline;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (var i = 0; i < steps.length; i++)
          _step(
            status: steps[i],
            isDone: steps[i].timelineIndex <= current.timelineIndex,
            isCurrent: steps[i] == current,
            isLast: i == steps.length - 1,
          ),
      ],
    );
  }

  Widget _step({
    required OrderStatus status,
    required bool isDone,
    required bool isCurrent,
    required bool isLast,
  }) {
    final at = OrderFormat.timestampFor(order, status);
    final note = OrderFormat.noteFor(order, status);
    final ink = isDone ? AppColors.textPrimary : AppColors.textSecondary;

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Column(
            children: [
              Container(
                width: _dot,
                height: _dot,
                decoration: BoxDecoration(
                  color: isDone ? AppColors.brandGreen : AppColors.surface,
                  shape: BoxShape.circle,
                  border: Border.all(
                    color:
                        isDone ? AppColors.brandGreen : AppColors.borderStrong,
                    width: 2,
                  ),
                ),
                child: isDone
                    ? const Icon(Icons.check_rounded,
                        size: 12, color: Colors.white)
                    : null,
              ),
              if (!isLast)
                Expanded(
                  child: Container(
                    width: 2,
                    margin: const EdgeInsets.symmetric(vertical: 2),
                    color:
                        isDone ? AppColors.brandGreen : AppColors.borderStrong,
                  ),
                ),
            ],
          ),
          const SizedBox(width: AppDimens.space12),
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(bottom: isLast ? 0 : _rowGap),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    status.label,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: isCurrent ? FontWeight.w800 : FontWeight.w700,
                      color: ink,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    at != null
                        ? OrderFormat.dateTime(at)
                        : (isDone ? 'Done' : 'Pending'),
                    style: const TextStyle(
                      fontSize: 12,
                      color: AppColors.textSecondary,
                    ),
                  ),
                  if (note.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(
                      note,
                      style: const TextStyle(
                        fontSize: 12,
                        color: AppColors.textFaint,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
