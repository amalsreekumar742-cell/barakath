import 'package:cloud_firestore/cloud_firestore.dart';

import '../../../../core/utils/model_parse.dart';
import '../../domain/entities/banner_item.dart';

/// A home/promo banner (`banners/{id}`), read-only in the app.
class BannerModel extends BannerItem {
  const BannerModel({
    required super.id,
    required super.title,
    required super.image,
    required super.linkType,
    required super.linkValue,
    required super.linkProductName,
    required super.linkCategoryName,
    required super.placement,
    required super.position,
    required super.isActive,
    required super.startDate,
    required super.endDate,
    required super.createdAt,
  });

  factory BannerModel.fromFirestore(DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data() ?? const {};
    return BannerModel(
      id: doc.id,
      title: ModelParse.toStr(data['title']),
      image: ModelParse.toStr(data['image']),
      linkType: ModelParse.toStr(data['linkType'], 'None'),
      linkValue: ModelParse.toStr(data['linkValue']),
      linkProductName: ModelParse.toStr(data['linkProductName']),
      linkCategoryName: ModelParse.toStr(data['linkCategoryName']),
      placement: ModelParse.toStr(data['placement'], 'App'),
      position: ModelParse.toInt(data['position']),
      isActive: ModelParse.toBool(data['isActive']),
      startDate: ModelParse.dateTime(data['startDate']),
      endDate: ModelParse.dateTime(data['endDate']),
      createdAt: ModelParse.dateTime(data['createdAt']),
    );
  }
}
