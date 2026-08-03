import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimens.dart';
import '../../../../core/constants/domain_enums.dart';
import '../../../../core/widgets/status_badge.dart';
import '../../../checkout/domain/entities/coupon.dart';
import '../../domain/entities/coupon_wallet_status.dart';
import 'coupon_code_box.dart';

/// One coupon in the wallet: the reward, the code with Copy, its minimum, its
/// expiry and a status badge.
///
/// Used and Expired cards are muted and their Copy is switched off — the code
/// is history at that point, and offering to copy it invites a customer to
/// paste something checkout will refuse.
class CouponWalletCard extends StatelessWidget {
  const CouponWalletCard({super.key, required this.coupon, required this.status});

  final Coupon coupon;
  final SpinRewardStatus status;

  bool get _isActive => status == SpinRewardStatus.active;

  @override
  Widget build(BuildContext context) {
    return Opacity(
      // The design mutes spent/lapsed cards rather than hiding them: the
      // customer still wants to see what they had.
      opacity: _isActive ? 1 : 0.6,
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(AppDimens.radiusCard),
          border: Border.all(
            color: _isActive ? AppColors.goldBorder : AppColors.hairline,
          ),
        ),
        clipBehavior: Clip.antiAlias,
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(
                width: 76,
                color: _isActive ? AppColors.goldSubtle : AppColors.surfaceSubtle,
                child: Icon(
                  Icons.card_giftcard_rounded,
                  size: 26,
                  color: _isActive ? AppColors.goldStrong : AppColors.muted,
                ),
              ),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.all(AppDimens.cardPadding),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Text(
                              couponRewardText(coupon),
                              style: TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.w800,
                                color: _isActive
                                    ? AppColors.goldStrong
                                    : AppColors.textSecondary,
                              ),
                            ),
                          ),
                          const SizedBox(width: AppDimens.space8),
                          StatusBadge.forStatus(status.label, dense: true),
                        ],
                      ),
                      const SizedBox(height: AppDimens.space4),
                      Text(
                        couponConditionsLine(coupon),
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppColors.textSecondary,
                        ),
                      ),
                      const SizedBox(height: AppDimens.space4),
                      Text(
                        _expiryLine(),
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: _expiryColor(),
                        ),
                      ),
                      const SizedBox(height: AppDimens.space10),
                      CouponCodeBox(
                        code: coupon.code,
                        enabled: _isActive,
                        dense: true,
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// "Expires in 45 minutes" / "Expires in 3 days" while it's close, an explicit
  /// date otherwise, and "Expired · 30 Mar" once it's gone.
  ///
  /// The sub-day units are not decoration: a spin campaign can grant a reward
  /// valid for a single hour, and this card is where the customer goes to find
  /// it. Rounding that to "Expires in 1 day" would hand them a deadline the
  /// server will not honour.
  String _expiryLine() {
    final until = coupon.validUntil;
    if (until == null) return _isActive ? 'No expiry' : status.label;

    final date = DateFormat('d MMM yyyy').format(until);
    if (status == SpinRewardStatus.expired) return 'Expired · $date';
    if (status == SpinRewardStatus.used) return 'Used · valid till $date';

    String plural(int n, String unit) => '$n $unit${n == 1 ? '' : 's'}';
    final left = until.difference(DateTime.now());
    if (left.isNegative || left == Duration.zero) return 'Expires today';
    if (left.inMinutes < 60) return 'Expires in ${plural(left.inMinutes, 'minute')}';
    if (left.inHours < 24) return 'Expires in ${plural(left.inHours, 'hour')}';
    final days = left.inHours ~/ 24;
    if (days <= 7) return 'Expires in ${plural(days, 'day')}';
    return 'Valid till $date';
  }

  Color _expiryColor() {
    if (!_isActive) return AppColors.textFaint;
    final until = coupon.validUntil;
    if (until == null) return AppColors.textSecondary;
    // Red only when it is genuinely about to lapse — a 3-day spin coupon is
    // always urgent, a 30-day one is not.
    final days = until.difference(DateTime.now()).inHours / 24;
    return days <= 3 ? AppColors.statusError : AppColors.textSecondary;
  }
}
