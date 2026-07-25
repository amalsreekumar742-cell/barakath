import 'package:equatable/equatable.dart';

/// A home/promo banner (`banners/{id}`), read-only in the app.
class BannerItem extends Equatable {
  final String id;
  final String title;
  final String image;

  /// 'Product' | 'Category' | 'External' | 'None'.
  final String linkType;

  /// Product id, category id, an external URL, or '' for None.
  final String linkValue;
  final String linkProductName;
  final String linkCategoryName;

  /// 'App' | 'Website' | 'Both'.
  final String placement;
  final int position;
  final bool isActive;
  final DateTime? startDate;
  final DateTime? endDate;
  final DateTime? createdAt;

  const BannerItem({
    required this.id,
    required this.title,
    required this.image,
    required this.linkType,
    required this.linkValue,
    required this.linkProductName,
    required this.linkCategoryName,
    required this.placement,
    required this.position,
    required this.isActive,
    required this.startDate,
    required this.endDate,
    required this.createdAt,
  });

  @override
  List<Object?> get props => [
        id,
        title,
        image,
        linkType,
        linkValue,
        linkProductName,
        linkCategoryName,
        placement,
        position,
        isActive,
        startDate,
        endDate,
        createdAt,
      ];
}
