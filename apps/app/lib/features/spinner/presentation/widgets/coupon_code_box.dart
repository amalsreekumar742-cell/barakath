import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimens.dart';
import '../../../../core/widgets/app_toast.dart';

/// The dashed gold box holding a coupon code, with a Copy affordance.
///
/// Shared by the reward sheet and the wallet card so a code always looks and
/// copies the same way. Copy is disabled for spent/lapsed coupons — offering to
/// copy a code that can no longer be applied is a small lie.
class CouponCodeBox extends StatelessWidget {
  const CouponCodeBox({
    super.key,
    required this.code,
    this.enabled = true,
    this.dense = false,
  });

  final String code;
  final bool enabled;

  /// Tighter type/padding for use inside a list card.
  final bool dense;

  void _copy(BuildContext context) {
    Clipboard.setData(ClipboardData(text: code));
    AppToast.success(context, 'Coupon code copied');
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: EdgeInsets.symmetric(
        horizontal: AppDimens.space12,
        vertical: dense ? AppDimens.space8 : AppDimens.cardPadding,
      ),
      decoration: BoxDecoration(
        color: enabled ? AppColors.goldSubtle : AppColors.surfaceSubtle,
        borderRadius: BorderRadius.circular(AppDimens.radiusMd),
        border: Border.all(
          color: enabled ? AppColors.goldBorder : AppColors.hairline,
        ),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(
              code,
              style: TextStyle(
                fontSize: dense ? 14 : 18,
                fontWeight: FontWeight.w800,
                letterSpacing: 2,
                color: enabled ? AppColors.goldStrong : AppColors.textSecondary,
              ),
            ),
          ),
          if (enabled)
            TextButton.icon(
              onPressed: () => _copy(context),
              icon: const Icon(Icons.copy_rounded, size: 16),
              label: const Text('Copy'),
              style: TextButton.styleFrom(
                foregroundColor: AppColors.goldStrong,
                padding: const EdgeInsets.symmetric(
                  horizontal: AppDimens.space8,
                ),
                minimumSize: const Size(0, 32),
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                textStyle: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
        ],
      ),
    );
  }
}
