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

  /// Server-decided expiry — the campaign's validity window applied at the
  /// moment of the spin (see `SpinnerCampaign.validityHours`, default 3 days).
  final DateTime? validUntil;

  /// Time left until the coupon lapses, as copy: 'expires in 45 minutes',
  /// 'expires in 1 hour', 'expires in 3 days'. Null once there is nothing left
  /// to say (no expiry on file, or already lapsed).
  ///
  /// WHY this replaced a whole-days count: a campaign can now grant a reward
  /// that lives for a single hour, and rounding that up to '1 day' told the
  /// customer their coupon lasted 24x longer than the server would honour.
  /// The unit is chosen from the ACTUAL remaining time, so short windows read
  /// in hours or minutes and long ones still read in days.
  String? expiresInLabel([DateTime? now]) {
    final until = validUntil;
    if (until == null) return null;
    final ms = until.difference(now ?? DateTime.now()).inMilliseconds;
    if (ms <= 0) return null;

    String plural(int n, String unit) => '$n $unit${n == 1 ? '' : 's'}';
    final minutes = ms ~/ 60000;
    if (minutes < 60) return 'expires in ${plural(minutes, 'minute')}';
    final hours = minutes ~/ 60;
    if (hours < 24) return 'expires in ${plural(hours, 'hour')}';
    return 'expires in ${plural(hours ~/ 24, 'day')}';
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
