import 'package:flutter/material.dart';

import '../constants/app_colors.dart';
import '../constants/app_dimens.dart';

/// One line of a price summary: label on the left, value on the right.
///
/// Used by the bag, checkout, order detail, invoice and withdrawal screens, so
/// the money column lines up identically everywhere.
class KeyValueRow extends StatelessWidget {
  const KeyValueRow({
    super.key,
    required this.label,
    required this.value,
    this.emphasis = false,
    this.strikeThrough = false,
    this.valueColor,
    this.labelColor,
  });

  final String label;
  final String value;

  /// The total line: both sides bold, value larger and gold.
  final bool emphasis;

  /// For a superseded amount (MRP before a discount).
  final bool strikeThrough;

  /// Overrides the value colour — e.g. green for a discount, red for a debit.
  /// Ignored when [emphasis] is set, which is always gold.
  final Color? valueColor;

  final Color? labelColor;

  @override
  Widget build(BuildContext context) {
    final labelStyle = TextStyle(
      fontSize: 13,
      fontWeight: emphasis ? FontWeight.w700 : FontWeight.w400,
      color: labelColor ??
          (emphasis ? AppColors.textPrimary : AppColors.textSecondary),
    );

    final valueStyle = TextStyle(
      fontSize: emphasis ? 18 : 13,
      fontWeight: emphasis ? FontWeight.w800 : FontWeight.w700,
      color: emphasis
          ? AppColors.goldStrong
          : (valueColor ?? AppColors.textPrimary),
      decoration: strikeThrough ? TextDecoration.lineThrough : null,
    );

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppDimens.space4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Expanded(child: Text(label, style: labelStyle)),
          const SizedBox(width: AppDimens.space12),
          Text(value, style: valueStyle),
        ],
      ),
    );
  }
}
