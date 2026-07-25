import 'package:flutter/material.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimens.dart';

/// The dark gradient affiliate strip from frame `36 · Profile`.
///
/// Rendered ONLY for an admin-allocated affiliate (a non-empty `affiliateCode`).
/// A normal customer sees no trace of it — not a disabled row, not a teaser.
class AffiliateBanner extends StatelessWidget {
  const AffiliateBanner({
    super.key,
    required this.withdrawable,
    required this.totalReferrals,
    required this.onTap,
  });

  /// The affiliate wallet balance shown as "₹X withdrawable".
  final double withdrawable;
  final int totalReferrals;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final referralLabel =
        totalReferrals == 1 ? '1 referral' : '$totalReferrals referrals';

    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        padding: const EdgeInsets.all(AppDimens.space16),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(AppDimens.radiusCard),
          gradient: const LinearGradient(
            begin: Alignment.centerLeft,
            end: Alignment.centerRight,
            colors: [AppColors.ink, AppColors.inkSoft],
          ),
        ),
        child: Row(
          children: [
            Container(
              width: 42,
              height: 42,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: AppColors.cta,
                borderRadius: BorderRadius.circular(AppDimens.radiusMd),
              ),
              child: const Icon(
                Icons.volunteer_activism_outlined,
                size: 22,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(width: AppDimens.space12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text(
                    'Affiliate dashboard',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w800,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '₹${withdrawable.toStringAsFixed(2)} withdrawable · $referralLabel',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 12,
                      color: AppColors.cta,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: AppDimens.space8),
            const Icon(
              Icons.chevron_right_rounded,
              size: 20,
              color: AppColors.cta,
            ),
          ],
        ),
      ),
    );
  }
}
