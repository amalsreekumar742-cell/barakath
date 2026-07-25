import 'package:equatable/equatable.dart';

/// A coupon document (`coupons/{id}`), applied at checkout.
class Coupon extends Equatable {
  final String id;
  final String code;
  final String description;

  /// 'Percentage' | 'Fixed'.
  final String discountType;
  final double discountValue;
  final double minimumOrderAmount;
  final double maximumDiscount;
  final int usageLimit;
  final int usedCount;
  final int perUserLimit;
  final DateTime? validFrom;
  final DateTime? validUntil;
  final bool isActive;
  final List<String> applicableCategories;
  final List<String> applicableProducts;

  /// 'All' | 'Category' | 'Product'.
  final String applicationType;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  const Coupon({
    required this.id,
    required this.code,
    required this.description,
    required this.discountType,
    required this.discountValue,
    required this.minimumOrderAmount,
    required this.maximumDiscount,
    required this.usageLimit,
    required this.usedCount,
    required this.perUserLimit,
    required this.validFrom,
    required this.validUntil,
    required this.isActive,
    required this.applicableCategories,
    required this.applicableProducts,
    required this.applicationType,
    required this.createdAt,
    required this.updatedAt,
  });

  @override
  List<Object?> get props => [
        id,
        code,
        description,
        discountType,
        discountValue,
        minimumOrderAmount,
        maximumDiscount,
        usageLimit,
        usedCount,
        perUserLimit,
        validFrom,
        validUntil,
        isActive,
        applicableCategories,
        applicableProducts,
        applicationType,
        createdAt,
        updatedAt,
      ];
}
