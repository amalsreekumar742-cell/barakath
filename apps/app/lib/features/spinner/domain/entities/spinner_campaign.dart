import 'package:equatable/equatable.dart';

import '../../../../core/constants/domain_enums.dart';

/// One wedge on the spin wheel (embedded in a campaign's `slots` array).
class SpinnerSlot extends Equatable {
  final String id;
  final String label;

  /// 'Coupon' | 'Better luck'.
  final String type;
  final String couponCode;
  final String couponId;

  /// 'Percentage' | 'Fixed'.
  final String discountType;
  final double discountValue;
  final double minimumOrderAmount;
  final double maximumDiscount;

  /// This slot's share of the 100% wheel.
  final double probability;

  /// Wedge fill colour (hex).
  final String color;

  const SpinnerSlot({
    required this.id,
    required this.label,
    required this.type,
    required this.couponCode,
    required this.couponId,
    required this.discountType,
    required this.discountValue,
    required this.minimumOrderAmount,
    required this.maximumDiscount,
    required this.probability,
    required this.color,
  });

  bool get isWin => type == 'Coupon';

  /// What the wedge reads on the wheel and in the result sheet. Falls back to
  /// the standard loss copy so a campaign with an unlabelled "Better luck" slot
  /// still renders something meaningful.
  String get rewardText =>
      label.trim().isNotEmpty ? label.trim() : (isWin ? 'Reward' : 'Better luck');

  @override
  List<Object?> get props => [
        id,
        label,
        type,
        couponCode,
        couponId,
        discountType,
        discountValue,
        minimumOrderAmount,
        maximumDiscount,
        probability,
        color,
      ];
}

/// A spin-the-wheel promotion (`spinnerCampaigns/{id}`), read-only in the app;
/// the app records spins as separate history docs (see below).
class SpinnerCampaign extends Equatable {
  final String id;
  final String name;
  final String description;
  final List<SpinnerSlot> slots;
  final int maxSpinsPerUser;
  final int spinCooldownHours;
  final int couponValidityDays;
  final bool isActive;
  final int totalSpins;
  final int totalWins;
  final DateTime? startDate;
  final DateTime? endDate;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  /// Which customers the campaign is for.
  ///
  /// NOTE: the DEPLOYED `spinWheel` callable does not read this field and the
  /// admin panel does not write it yet, so a live document parses as
  /// [SpinEligibility.allUsers] and everyone passes. It exists so the audience
  /// gate in spec §4.14 can be honoured the day the admin form ships it —
  /// without it the app would silently ignore a configured audience.
  final SpinEligibility eligibility;

  const SpinnerCampaign({
    required this.id,
    required this.name,
    required this.description,
    required this.slots,
    required this.maxSpinsPerUser,
    required this.spinCooldownHours,
    required this.couponValidityDays,
    required this.isActive,
    required this.totalSpins,
    required this.totalWins,
    required this.startDate,
    required this.endDate,
    required this.createdAt,
    required this.updatedAt,
    this.eligibility = SpinEligibility.allUsers,
  });

  /// Live right now: flagged active AND inside `[startDate, endDate]`.
  ///
  /// Mirrors the same three checks `spinWheel` runs server-side, so the wheel is
  /// never drawn for a campaign the callable would reject.
  bool isLiveAt(DateTime now) {
    if (!isActive) return false;
    if (startDate != null && now.isBefore(startDate!)) return false;
    if (endDate != null && now.isAfter(endDate!)) return false;
    return true;
  }

  @override
  List<Object?> get props => [
        id,
        name,
        description,
        slots,
        maxSpinsPerUser,
        spinCooldownHours,
        couponValidityDays,
        isActive,
        totalSpins,
        totalWins,
        startDate,
        endDate,
        createdAt,
        updatedAt,
        eligibility,
      ];
}
