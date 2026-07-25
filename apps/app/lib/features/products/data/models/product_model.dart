import 'package:cloud_firestore/cloud_firestore.dart';

import '../../../../core/utils/model_parse.dart';
import '../../domain/entities/product.dart';

/// One row of a product's specification table (`key: value`).
class SpecificationModel extends Specification {
  const SpecificationModel({required super.key, required super.value});

  factory SpecificationModel.fromMap(Map<String, dynamic> data) {
    return SpecificationModel(
      key: ModelParse.toStr(data['key']),
      value: ModelParse.toStr(data['value']),
    );
  }

  Map<String, dynamic> toMap() => {'key': key, 'value': value};
}

/// A catalogue product document (`products/{id}`).
///
/// Per-variant pricing lives on the variant subcollection ([VariantModel]); this
/// doc carries denormalised `thumbnail` / `minPrice` / `maxPrice` for list
/// rendering plus the server-computed `stockStatus` / `totalStock`. Ratings are
/// stored as `averageRating` + `totalReviews` (recomputed by Cloud Functions).
class ProductModel extends Product {
  const ProductModel({
    required super.id,
    required super.name,
    required super.sku,
    required super.description,
    required super.categoryId,
    required super.categoryName,
    required super.subCategoryId,
    required super.subCategoryName,
    required super.images,
    required super.specifications,
    required super.youtubeVideoLink,
    required super.isCombo,
    required super.comboDeliveryCharge,
    required super.replacementAvailable,
    required super.lowStockThreshold,
    required super.frequentlyBoughtTogether,
    required super.status,
    required super.stockStatus,
    required super.totalStock,
    required super.thumbnail,
    required super.minPrice,
    required super.maxPrice,
    required super.isNewArrival,
    required super.isFlashSale,
    required super.averageRating,
    required super.totalReviews,
    required super.keywords,
    required super.createdAt,
    required super.updatedAt,
  });

  factory ProductModel.fromFirestore(DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data() ?? const {};
    return ProductModel(
      id: doc.id,
      name: ModelParse.toStr(data['name']),
      sku: ModelParse.toStr(data['sku']),
      description: ModelParse.toStr(data['description']),
      categoryId: ModelParse.toStr(data['categoryId']),
      categoryName: ModelParse.toStr(data['categoryName']),
      subCategoryId: ModelParse.toStr(data['subCategoryId']),
      subCategoryName: ModelParse.toStr(data['subCategoryName']),
      images: ModelParse.stringList(data['images']),
      specifications: ModelParse.mapList(data['specifications'])
          .map(SpecificationModel.fromMap)
          .toList(),
      youtubeVideoLink: ModelParse.toStr(data['youtubeVideoLink']),
      isCombo: ModelParse.toBool(data['isCombo']),
      comboDeliveryCharge: ModelParse.toDouble(data['comboDeliveryCharge']),
      replacementAvailable: ModelParse.toBool(data['replacementAvailable']),
      lowStockThreshold: ModelParse.toInt(data['lowStockThreshold']),
      frequentlyBoughtTogether:
          ModelParse.stringList(data['frequentlyBoughtTogether']),
      status: ModelParse.toStr(data['status'], 'Active'),
      stockStatus: ModelParse.toStr(data['stockStatus'], 'In stock'),
      totalStock: ModelParse.toInt(data['totalStock']),
      thumbnail: ModelParse.toStr(data['thumbnail']),
      minPrice: ModelParse.toDouble(data['minPrice']),
      maxPrice: ModelParse.toDouble(data['maxPrice']),
      isNewArrival: ModelParse.toBool(data['isNewArrival']),
      isFlashSale: ModelParse.toBool(data['isFlashSale']),
      averageRating: ModelParse.toDouble(data['averageRating']),
      totalReviews: ModelParse.toInt(data['totalReviews']),
      keywords: ModelParse.stringList(data['keywords']),
      createdAt: ModelParse.dateTime(data['createdAt']),
      updatedAt: ModelParse.dateTime(data['updatedAt']),
    );
  }
}
