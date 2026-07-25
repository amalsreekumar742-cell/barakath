import '../../../../core/constants/domain_enums.dart';
import '../../../checkout/domain/entities/coupon.dart';

/// Which wallet tab a coupon belongs in.
///
/// There is no `status` field on a `coupons` document — the deployed schema
/// carries `usedCount`/`usageLimit`, `isActive` and `validUntil`, so the tab is
/// DERIVED. Order matters: a coupon that was both spent and has since lapsed
/// reads as Used, because that is the fact the customer cares about.
SpinRewardStatus couponWalletStatus(Coupon coupon, {DateTime? now}) {
  final at = now ?? DateTime.now();

  final limit = coupon.usageLimit > 0 ? coupon.usageLimit : 1;
  if (coupon.usedCount >= limit) return SpinRewardStatus.used;

  if (!coupon.isActive) return SpinRewardStatus.expired;
  final until = coupon.validUntil;
  if (until != null && until.isBefore(at)) return SpinRewardStatus.expired;

  return SpinRewardStatus.active;
}

/// The single-line conditions under the reward text, e.g.
/// "Spin reward · min ₹50" — omits the minimum when the coupon has none.
String couponConditionsLine(Coupon coupon) {
  final min = coupon.minimumOrderAmount;
  if (min <= 0) return 'Spin reward';
  return 'Spin reward · min ₹${formatMoney(min)}';
}

/// The headline a coupon card shows — the discount in plain words.
String couponRewardText(Coupon coupon) {
  final value = coupon.discountValue;
  if (value <= 0) return coupon.code;
  return coupon.discountType == 'Percentage'
      ? '${formatMoney(value)}% off'
      : '₹${formatMoney(value)} off';
}

/// Trims a trailing `.0` so ₹50 doesn't render as ₹50.0. Shared by the wallet
/// card and the reward sheet so one discount never prints two ways.
String formatMoney(double value) =>
    value == value.roundToDouble() ? value.round().toString() : value.toStringAsFixed(2);
