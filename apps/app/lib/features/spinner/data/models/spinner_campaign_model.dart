import 'package:cloud_firestore/cloud_firestore.dart';

import '../../../../core/constants/domain_enums.dart';
import '../../../../core/utils/model_parse.dart';
import '../../domain/entities/spinner_campaign.dart';

/// One wedge on the spin wheel (embedded in a campaign's `slots` array).
class SpinnerSlotModel extends SpinnerSlot {
  const SpinnerSlotModel({
    required super.id,
    required super.label,
    required super.type,
    required super.couponCode,
    required super.couponId,
    required super.discountType,
    required super.discountValue,
    required super.minimumOrderAmount,
    required super.maximumDiscount,
    required super.probability,
    required super.color,
  });

  factory SpinnerSlotModel.fromMap(Map<String, dynamic> data) {
    return SpinnerSlotModel(
      id: ModelParse.toStr(data['id']),
      label: ModelParse.toStr(data['label']),
      type: ModelParse.toStr(data['type'], 'Better luck'),
      couponCode: ModelParse.toStr(data['couponCode']),
      couponId: ModelParse.toStr(data['couponId']),
      discountType: ModelParse.toStr(data['discountType'], 'Percentage'),
      discountValue: ModelParse.toDouble(data['discountValue']),
      minimumOrderAmount: ModelParse.toDouble(data['minimumOrderAmount']),
      maximumDiscount: ModelParse.toDouble(data['maximumDiscount']),
      probability: ModelParse.toDouble(data['probability']),
      color: ModelParse.toStr(data['color']),
    );
  }
}

/// A spin-the-wheel promotion (`spinnerCampaigns/{id}`), read-only in the app;
/// the app records spins as separate history docs (see below).
class SpinnerCampaignModel extends SpinnerCampaign {
  const SpinnerCampaignModel({
    required super.id,
    required super.name,
    required super.description,
    required super.slots,
    required super.maxSpinsPerUser,
    required super.spinCooldownHours,
    required super.couponValidityDays,
    super.couponValidityHours,
    required super.isActive,
    required super.totalSpins,
    required super.totalWins,
    required super.startDate,
    required super.endDate,
    required super.createdAt,
    required super.updatedAt,
    super.eligibility,
  });

  factory SpinnerCampaignModel.fromFirestore(
    DocumentSnapshot<Map<String, dynamic>> doc,
  ) {
    final data = doc.data() ?? const {};
    return SpinnerCampaignModel(
      id: doc.id,
      name: ModelParse.toStr(data['name']),
      description: ModelParse.toStr(data['description']),
      slots: ModelParse.mapList(data['slots'])
          .map(SpinnerSlotModel.fromMap)
          .toList(),
      maxSpinsPerUser: ModelParse.toInt(data['maxSpinsPerUser']),
      spinCooldownHours: ModelParse.toInt(data['spinCooldownHours']),
      couponValidityDays: ModelParse.toInt(data['couponValidityDays']),
      // Absent on campaigns saved before the hours field shipped; parses to 0,
      // which makes `validityHours` fall back to the day value. See
      // SpinnerCampaign.validityHours.
      couponValidityHours: ModelParse.toInt(data['couponValidityHours']),
      isActive: ModelParse.toBool(data['isActive']),
      totalSpins: ModelParse.toInt(data['totalSpins']),
      totalWins: ModelParse.toInt(data['totalWins']),
      startDate: ModelParse.dateTime(data['startDate']),
      endDate: ModelParse.dateTime(data['endDate']),
      createdAt: ModelParse.dateTime(data['createdAt']),
      updatedAt: ModelParse.dateTime(data['updatedAt']),
      // Absent on every live document today — the parser falls back to
      // "All users", so an unconfigured campaign is open to everyone.
      eligibility: SpinEligibilityX.from(ModelParse.toStr(data['eligibility'])),
    );
  }
}
