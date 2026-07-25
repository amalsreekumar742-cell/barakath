import 'package:equatable/equatable.dart';

/// The coupon minted by a winning spin.
///
/// Mirrors `couponDetails` on the `spinWheel` callable's response. The document
/// itself already exists in `coupons` by the time this reaches the app — the
/// client writes NOTHING; this is just what to print on the result sheet.
class SpinRewardCoupon extends Equatable {
  const SpinRewardCoupon({
    required this.code,
    required this.discountType,
    required this.discountValue,
    required this.minimumOrderAmount,
    required this.maximumDiscount,
    required this.validUntil,
  });

  /// `SPIN-XXXXXX`.
  final String code;

  /// 'Percentage' | 'Fixed'.
  final String discountType;
  final double discountValue;
  final double minimumOrderAmount;
  final double maximumDiscount;

  /// Server-decided expiry (campaign `couponValidityDays`, default +3 days).
  final DateTime? validUntil;

  /// Whole days from [now] until the coupon lapses, floored at 0. Drives the
  /// "Expires in 3 days" line — computed from the RETURNED date, never assumed.
  int daysRemaining([DateTime? now]) {
    final until = validUntil;
    if (until == null) return 0;
    final diff = until.difference(now ?? DateTime.now()).inHours;
    return diff <= 0 ? 0 : (diff / 24).ceil();
  }

  @override
  List<Object?> get props => [
        code,
        discountType,
        discountValue,
        minimumOrderAmount,
        maximumDiscount,
        validUntil,
      ];
}

/// The outcome of ONE spin, exactly as the `spinWheel` callable reported it.
///
/// WHY the server owns this: the reward is money. The client sends a campaign
/// id, the function runs the weighted draw, writes the coupon and the
/// `spinHistory` record, and hands back the wedge it landed on. The wheel
/// animation is then aimed at that wedge — the UI illustrates the result, it
/// does not produce it.
class SpinResult extends Equatable {
  const SpinResult({
    required this.resultType,
    required this.slotLabel,
    required this.couponCode,
    required this.coupon,
  });

  /// 'Coupon' | 'Better luck'.
  final String resultType;

  /// The `label` of the slot the server landed on — used to find the wedge to
  /// stop the wheel on, and shown as the reward headline.
  final String slotLabel;

  /// Empty on a loss.
  final String couponCode;

  /// Null on a loss.
  final SpinRewardCoupon? coupon;

  bool get isWin => resultType == 'Coupon';

  String get rewardText =>
      slotLabel.trim().isNotEmpty ? slotLabel.trim() : 'Better luck next time';

  @override
  List<Object?> get props => [resultType, slotLabel, couponCode, coupon];
}
