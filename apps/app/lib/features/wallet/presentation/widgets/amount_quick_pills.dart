import 'package:flutter/material.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimens.dart';
import 'wallet_money.dart';

/// The four one-tap top-up amounts under the amount field.
///
/// ₹100 / ₹500 / ₹1,000 / ₹2,000 — straight from the `Wallet · Add money` panel.
/// Spec §2.20 is silent on the values (it only says "no min/max"), so the
/// prototype wins here (docs/design/app/BATCH4_DESIGN_MAP.md §4 row 11). These
/// are shortcuts, NOT limits: the field accepts any positive amount.
class AmountQuickPills extends StatelessWidget {
  const AmountQuickPills({
    super.key,
    required this.selected,
    required this.onSelected,
  });

  static const List<double> amounts = [100, 500, 1000, 2000];

  /// The currently typed amount — a pill highlights when it matches exactly.
  final double? selected;
  final ValueChanged<double> onSelected;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        for (final amount in amounts) ...[
          Expanded(
            child: _Pill(
              label: WalletMoney.whole(amount),
              isSelected: selected == amount,
              onTap: () => onSelected(amount),
            ),
          ),
          if (amount != amounts.last) const SizedBox(width: AppDimens.space8),
        ],
      ],
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill({
    required this.label,
    required this.isSelected,
    required this.onTap,
  });

  final String label;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        alignment: Alignment.center,
        padding: const EdgeInsets.symmetric(vertical: 11),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.brandGreen : AppColors.surface,
          borderRadius: BorderRadius.circular(AppDimens.radiusMd),
          border: Border.all(
            color: isSelected ? AppColors.brandGreen : AppColors.borderStrong,
          ),
        ),
        child: Text(
          label,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w700,
            color: isSelected ? Colors.white : AppColors.textSecondary,
          ),
        ),
      ),
    );
  }
}
