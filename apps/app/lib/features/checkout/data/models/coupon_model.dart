import 'package:cloud_firestore/cloud_firestore.dart';

import '../../../../core/utils/model_parse.dart';
import '../../domain/entities/coupon.dart';

/// A coupon document (`coupons/{id}`), applied at checkout.
class CouponModel extends Coupon {
  const CouponModel({
    required super.id,
    required super.code,
    required super.description,
    required super.discountType,
    required super.discountValue,
    required super.minimumOrderAmount,
    required super.maximumDiscount,
    required super.usageLimit,
    required super.usedCount,
    required super.perUserLimit,
    required super.validFrom,
    required super.validUntil,
    required super.isActive,
    required super.applicableCategories,
    required super.applicableProducts,
    required super.applicationType,
    required super.createdAt,
    required super.updatedAt,
  });

  factory CouponModel.fromFirestore(DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data() ?? const {};
    return CouponModel(
      id: doc.id,
      code: ModelParse.toStr(data['code']),
      description: ModelParse.toStr(data['description']),
      discountType: ModelParse.toStr(data['discountType'], 'Percentage'),
      discountValue: ModelParse.toDouble(data['discountValue']),
      minimumOrderAmount: ModelParse.toDouble(data['minimumOrderAmount']),
      maximumDiscount: ModelParse.toDouble(data['maximumDiscount']),
      usageLimit: ModelParse.toInt(data['usageLimit']),
      usedCount: ModelParse.toInt(data['usedCount']),
      perUserLimit: ModelParse.toInt(data['perUserLimit']),
      validFrom: ModelParse.dateTime(data['validFrom']),
      validUntil: ModelParse.dateTime(data['validUntil']),
      isActive: ModelParse.toBool(data['isActive']),
      applicableCategories: ModelParse.stringList(data['applicableCategories']),
      applicableProducts: ModelParse.stringList(data['applicableProducts']),
      applicationType: ModelParse.toStr(data['applicationType'], 'All'),
      createdAt: ModelParse.dateTime(data['createdAt']),
      updatedAt: ModelParse.dateTime(data['updatedAt']),
    );
  }
}
