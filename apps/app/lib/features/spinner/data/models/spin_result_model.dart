import '../../../../core/utils/model_parse.dart';
import '../../domain/entities/spin_result.dart';

/// Parses the `spinWheel` callable's response.
///
/// The wire shape (functions/src/growth/spinWheel.ts):
/// ```
/// {
///   resultType: 'Coupon' | 'Better luck',
///   slotLabel: string,
///   couponCode?: string,
///   couponDetails?: {
///     code, discountType, discountValue,
///     minimumOrderAmount, maximumDiscount,
///     validUntil,          // epoch MILLISECONDS, not a Timestamp
///   },
/// }
/// ```
/// `couponCode`/`couponDetails` are present only on a win.
class SpinResultModel extends SpinResult {
  const SpinResultModel({
    required super.resultType,
    required super.slotLabel,
    required super.couponCode,
    required super.coupon,
  });

  factory SpinResultModel.fromCallable(Map<String, dynamic> data) {
    final details = ModelParse.map(data['couponDetails']);
    return SpinResultModel(
      resultType: ModelParse.toStr(data['resultType'], 'Better luck'),
      slotLabel: ModelParse.toStr(data['slotLabel']),
      couponCode: ModelParse.toStr(data['couponCode']),
      coupon: details.isEmpty ? null : SpinRewardCouponModel.fromMap(details),
    );
  }
}

class SpinRewardCouponModel extends SpinRewardCoupon {
  const SpinRewardCouponModel({
    required super.code,
    required super.discountType,
    required super.discountValue,
    required super.minimumOrderAmount,
    required super.maximumDiscount,
    required super.validUntil,
  });

  factory SpinRewardCouponModel.fromMap(Map<String, dynamic> data) {
    return SpinRewardCouponModel(
      code: ModelParse.toStr(data['code']),
      discountType: ModelParse.toStr(data['discountType'], 'Percentage'),
      discountValue: ModelParse.toDouble(data['discountValue']),
      minimumOrderAmount: ModelParse.toDouble(data['minimumOrderAmount']),
      maximumDiscount: ModelParse.toDouble(data['maximumDiscount']),
      // Epoch millis over the callable wire. Coerced to `int` first because a
      // JSON number can arrive as a `double`, which ModelParse.dateTime would
      // otherwise drop to null and cost us the "expires in N days" line.
      validUntil: ModelParse.dateTime(_toMillis(data['validUntil'])),
    );
  }

  static Object? _toMillis(dynamic value) =>
      value is num ? value.toInt() : value;
}
